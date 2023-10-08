import { Connection, PublicKey, Keypair, Authorized, Signer, StakeProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { depositSol} from '@solana/spl-stake-pool';
import { Marinade, MarinadeUtils, MarinadeConfig } from '@marinade.finance/marinade-ts-sdk'
import { Account, AccountTypes } from '../models/accounts'

export async function stakeTransaction(
      connection: Connection,
      publicKey: PublicKey,
      splitLST: {native: number, mSOL: number, bSOL: number, jitoSOL: number},
  ) {
      const amountToNativeStake = Number(splitLST.native * 10 ** 9).toFixed(0)
      const stakeAccount = Keypair.generate();
      const createStakeAccountTx = StakeProgram.createAccount({
        authorized: new Authorized(publicKey, publicKey), // Here we set two authorities: Stake Authority and Withdrawal Authority. Both are set to our wallet.
        fromPubkey: publicKey,
        lamports: Number(amountToNativeStake),
        stakePubkey: stakeAccount.publicKey,
      });

      //https://solanacookbook.com/references/staking.html#delegate-stake
      const delegateTx = StakeProgram.delegate({
        stakePubkey: stakeAccount.publicKey,
        authorizedPubkey: publicKey,
        votePubkey: new PublicKey("Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9"),
      });

      const amountToBsolStake = Number(splitLST.bSOL * 10 ** 9).toFixed(0)
      const BLAZESTAKE_POOL = new PublicKey("stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov8HFDuMi");
      const validator = "Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9";
      const BSOL_REFERRAL = new PublicKey("ztcuSR1UPm7VBwjtDe6jhWxHuBsgQWmLASqM4reKhhC");
      const lamportsBsol = Number(amountToBsolStake);

      const memo = JSON.stringify({
        type: "cls/validator_stake/lamports",
        value: {
          validator: validator
        }
      });

      const depositBsolTx = await depositSol(
        connection,
        BLAZESTAKE_POOL,
        publicKey,
        lamportsBsol,
        undefined,
        BSOL_REFERRAL,
      );

      const memoInstruction = new TransactionInstruction({
          keys: [{
              pubkey: publicKey,
              isSigner: true,
              isWritable: true
          }],
          programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
          data: Buffer.from(memo, "utf-8"),
      });

      const amountToJitosolStake = Number(splitLST.jitoSOL * 10 ** 9).toFixed(0)
      const JITO_POOL = new PublicKey("Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb");
      const JITO_REFERRAL = new PublicKey("HwESEdNkry4NMD416WLkCqHs7pF5L7Y8LMeGg3xPgmzX");
      const lamportsJitosol = Number(amountToJitosolStake);

      const depositJitoTx = await depositSol(
          connection,
          JITO_POOL,
          publicKey,
          lamportsJitosol,
          undefined,
          JITO_REFERRAL,
      );

      const config = new MarinadeConfig({
        connection: connection,
        publicKey: publicKey,
        //referralCode: new web3.PublicKey(MY_REFERRAL_ACCOUNT),
      })
      const marinade = new Marinade(config)
        
      const validatorVoteAddress = new PublicKey("Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9");
      const { transaction: depositMsolTx } = await marinade.deposit(
        MarinadeUtils.solToLamports(splitLST.mSOL),
        { directToValidatorVoteAddress: validatorVoteAddress }
      )
      
      const signers: Signer[] = [];
      const instructions: TransactionInstruction[] = [];
      if (splitLST.native){
        instructions.push(createStakeAccountTx.instructions[0],
          createStakeAccountTx.instructions[1],
          delegateTx.instructions[0],)
        signers.push(stakeAccount)
      }
      if (splitLST.bSOL){
        instructions.push(...depositBsolTx.instructions, memoInstruction,)
        signers.push(...depositBsolTx.signers,)
      }
      if (splitLST.jitoSOL){
        instructions.push(...depositJitoTx.instructions,)
        signers.push(...depositJitoTx.signers,)
      }
      if (splitLST.mSOL){
        instructions.push(...depositMsolTx.instructions,)
      }
        
      const addressLookupTableAccounts = await connection
      .getAddressLookupTable(new PublicKey('9cpmAAabnUEuBhBhjR3avSsNGuVGFi8LzvqNiiuMAiJw'))
      .then((res) => res.value);
            
      // create v0 compatible message
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: await (await connection.getLatestBlockhash()).blockhash,
        instructions,
      }).compileToV0Message([addressLookupTableAccounts]);
          
      const transaction = new VersionedTransaction(messageV0);   
    
      if (transaction.serialize().length <= 1232){

          return [{transaction: transaction, signers: signers}]

      } else {

        const signersTx1: Signer[] = [];
        const signersTx2: Signer[] = [];
        const instructionsTx1: TransactionInstruction[] = [];
        const instructionsTx2: TransactionInstruction[] = [];

        if (splitLST.native){
          instructionsTx1.push(createStakeAccountTx.instructions[0],
              createStakeAccountTx.instructions[1],
              delegateTx.instructions[0],
              )
            signersTx1.push(stakeAccount)
        }
        if (splitLST.bSOL){
          instructionsTx2.push(...depositBsolTx.instructions, memoInstruction,)
          signersTx2.push(...depositBsolTx.signers,)
        }
        if (splitLST.jitoSOL){
          instructionsTx2.push(...depositJitoTx.instructions, )
          signersTx2.push(...depositJitoTx.signers, )
        }
        if (splitLST.mSOL){
          instructionsTx2.push(...depositMsolTx.instructions,)
        }

        const addressLookupTableAccounts = await connection
        .getAddressLookupTable(new PublicKey('9cpmAAabnUEuBhBhjR3avSsNGuVGFi8LzvqNiiuMAiJw'))
        .then((res) => res.value);
              
        // create v0 compatible message
        const messageV01 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: await (await connection.getLatestBlockhash()).blockhash,
          instructions: instructionsTx1,
        }).compileToV0Message([addressLookupTableAccounts]);
            
        const transaction1 = new VersionedTransaction(messageV01);
      
        // create v0 compatible message
        const messageV02 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: await (await connection.getLatestBlockhash()).blockhash,
          instructions: instructionsTx2,
        }).compileToV0Message([addressLookupTableAccounts]);
            
        const transaction2 = new VersionedTransaction(messageV02);
            
        return [{transaction: transaction1, signers: signersTx1}, {transaction: transaction2, signers: signersTx2}]
      }
  }
