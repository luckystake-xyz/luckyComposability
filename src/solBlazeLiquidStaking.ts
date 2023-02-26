import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { depositSol, depositStake, withdrawSol, withdrawStake, stakePoolInfo } from '@solana/spl-stake-pool';
import fetch from 'node-fetch';
import { Account, AccountTypes } from '../models/accounts'

function updatePool() {
  return new Promise(async (resolve, reject) => {
      try {
          let result = await (await fetch(
              "https://stake.solblaze.org/api/v1/update_pool?network=mainnet-beta"
          )).json();
          if(result.success) {
              resolve(result.success);
          } else {
              reject();
          }
      } catch(err) {
          reject();
      }
  });
}

export async function stakeTransaction(
    connection: Connection,
    publicKey: PublicKey,
    account: Account,
    value: number,
  ) {
    const amountUserWantsToStake = value * 10 ** account.decimals
    const BLAZESTAKE_POOL = new PublicKey("stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov8HFDuMi");
    const SOLPAY_API_ACTIVATION = new PublicKey("7f18MLpvAp48ifA1B8q8FBdrGQhyt9u5Lku2VBYejzJL");
    const validator = "Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9";
    const referral = new PublicKey("ztcuSR1UPm7VBwjtDe6jhWxHuBsgQWmLASqM4reKhhC");
    let lamports = amountUserWantsToStake;
    let info = await stakePoolInfo(connection, BLAZESTAKE_POOL);
      if(info.details.updateRequired) {
          await updatePool();
      }
  
    if(account.account == AccountTypes.Native){
      // https://stake-docs.solblaze.org/developers/typescript-sdk#stake-sol-through-cls-with-referral
      let depositTx = await depositSol(
          connection,
          BLAZESTAKE_POOL,
          publicKey,
          lamports,
          undefined,
          referral
      );

      let memo = JSON.stringify({
          type: "cls/validator_stake/lamports",
          value: {
              validator: validator
          }
      });

      let memoInstruction = new TransactionInstruction({
          keys: [{
              pubkey: publicKey,
              isSigner: true,
              isWritable: true
          }],
          programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
          data: Buffer.from(memo, "utf-8"),
      });

      let transaction = new Transaction();
      transaction.add(SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: SOLPAY_API_ACTIVATION,
          lamports: 5000
      }));
      transaction.add(...depositTx.instructions);
      transaction.add(memoInstruction);

      transaction.feePayer = publicKey;
      transaction.recentBlockhash = await (await connection.getRecentBlockhash()).blockhash;
      
      let signers = depositTx.signers;
      if(signers.length > 0) {
          transaction.partialSign(...signers);
      }
  
      return transaction
    } else if (account.account == AccountTypes.Staking){
        // https://stake-docs.solblaze.org/developers/typescript-sdk#stake-sol-through-cls-from-stake-account
        let stakeAccount = new PublicKey(account.pubkey)
        let stakeAccountValidator = new PublicKey(account.voter)

        let depositTx = await depositStake(
            connection,
            BLAZESTAKE_POOL,
            publicKey,
            stakeAccountValidator,
            stakeAccount
        );

        let memo = JSON.stringify({
            type: "cls/validator_stake/stake_accounts",
            value: {
                validator: validator
            }
        });

        let memoInstruction = new TransactionInstruction({
            keys: [{
                pubkey: publicKey,
                isSigner: true,
                isWritable: true
            }],
            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
            data: Buffer.from(memo, "utf-8"),
        });

        let transaction = new Transaction();
        transaction.add(SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: SOLPAY_API_ACTIVATION,
            lamports: 5000
        }));
        transaction.add(...depositTx.instructions);
        transaction.add(memoInstruction);

        transaction.feePayer = publicKey;
        transaction.recentBlockhash = await (await connection.getRecentBlockhash()).blockhash;

        let signers = depositTx.signers;
        if(signers.length > 0) {
            transaction.partialSign(...signers);
        }
        return transaction
    }
  }

  export async function instantUnstakeTransaction(
    connection: Connection,
    publicKey: PublicKey,
    account: Account,
    value: number, 
  ) {
    // https://stake-docs.solblaze.org/developers/typescript-sdk#unstake-sol-through-cls-instant
    const amount = value
    const BLAZESTAKE_POOL = new PublicKey("stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov8HFDuMi");
    const SOLPAY_API_ACTIVATION = new PublicKey("7f18MLpvAp48ifA1B8q8FBdrGQhyt9u5Lku2VBYejzJL");
    const validator = "Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9";
    const wallet = publicKey

    let info = await stakePoolInfo(connection, BLAZESTAKE_POOL);
    if(info.details.updateRequired) {
        await updatePool();
    }

        let withdrawTx = await withdrawSol(
            connection,
            BLAZESTAKE_POOL,
            wallet,
            wallet,
            amount
        );

        let memo = JSON.stringify({
            type: "cls/validator_unstake/lamports",
            value: {
                validator: validator
            }
        });

        let memoInstruction = new TransactionInstruction({
            keys: [{
                pubkey: wallet,
                isSigner: true,
                isWritable: true
            }],
            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
            data: Buffer.from(memo, "utf-8"),
        });

        let transaction = new Transaction();
        transaction.add(SystemProgram.transfer({
            fromPubkey: wallet,
            toPubkey: SOLPAY_API_ACTIVATION,
            lamports: 5000
        }));
        transaction.add(...withdrawTx.instructions);
        transaction.add(memoInstruction);

        transaction.feePayer = publicKey;
        transaction.recentBlockhash = await (await connection.getRecentBlockhash()).blockhash;

        let signers = withdrawTx.signers;
        if(signers.length > 0) {
            transaction.partialSign(...signers);
        }

        return transaction
    }

export async function unstakeTransaction(
    connection: Connection,
    publicKey: PublicKey,
    account: any,
    value: number,  
) {
    // https://stake-docs.solblaze.org/developers/typescript-sdk#unstake-sol-through-cls-delayed
    const amount = value
    const BLAZESTAKE_POOL = new PublicKey("stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov8HFDuMi");
    const SOLPAY_API_ACTIVATION = new PublicKey("7f18MLpvAp48ifA1B8q8FBdrGQhyt9u5Lku2VBYejzJL");
    const validator = "Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9";
    const wallet = publicKey
        
    let info = await stakePoolInfo(connection, BLAZESTAKE_POOL);
    if(info.details.updateRequired) {
        await updatePool();
    }

    let transactions = [];

    let withdrawTx = await withdrawStake(
        connection,
        BLAZESTAKE_POOL,
        wallet,
        amount,
        false
    );

    let memo = JSON.stringify({
        type: "cls/validator_unstake/stake_accounts",
        value: {
            validator: validator
        }
    });

    let max_per_tx = 5;
    
    let instructions = withdrawTx.instructions;
    for(let i = 0; i < (instructions.length - 1) / 2; i += max_per_tx) {
        let memoInstruction = new TransactionInstruction({
            keys: [{
                pubkey: wallet,
                isSigner: true,
                isWritable: true
            }],
            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
            data: Buffer.from(memo, "utf-8"),
        });

        if(i == 0) {
            let transaction = new Transaction();
            transaction.add(SystemProgram.transfer({
                fromPubkey: wallet,
                toPubkey: SOLPAY_API_ACTIVATION,
                lamports: 5000
            }));
            transaction.add(
                ...instructions.slice(0, 1 + (max_per_tx * 2))
            );
            transaction.add(memoInstruction);
            
            let signers = [...withdrawTx.signers.slice(0, 1 + max_per_tx)];
            transaction.feePayer = publicKey;
            transaction.recentBlockhash = await (await connection.getRecentBlockhash()).blockhash;
            if(signers.length > 0) {
                transaction.partialSign(...signers);
            }
            
            transactions.push(transaction);
        } else {
            let transaction = new Transaction();
            transaction.add(SystemProgram.transfer({
                fromPubkey: wallet,
                toPubkey: SOLPAY_API_ACTIVATION,
                lamports: 5000
            }));
            transaction.add(
                ...instructions.slice((i * 2) + 1, (i * 2) + 1 + (max_per_tx * 2))
            );
            transaction.add(memoInstruction);
            
            let signers = [
                withdrawTx.signers[0],
                ...withdrawTx.signers.slice(i + 1, i + 1 + max_per_tx)
            ];
            transaction.feePayer = publicKey;
            transaction.recentBlockhash = await (await connection.getRecentBlockhash()).blockhash;
            if(signers.length > 0) {
                transaction.partialSign(...signers);
            }

            transactions.push(transaction);
        }
    }

    return transactions
}
