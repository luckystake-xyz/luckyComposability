import { Connection, Keypair, PublicKey, StakeProgram } from "@solana/web3.js";
import { Account, AccountTypes } from '../models/accounts'

export async function unstakeTransaction(
    connection: Connection,
    publicKey: PublicKey,
    account: Account,
    value: number,
  ) {

    function split(actualStakeAccount, amountUserWantsToUntake){
      const splitAccount = Keypair.generate();
      const splitTx = StakeProgram.split({
        authorizedPubkey: publicKey,
        lamports: amountUserWantsToUntake,
        splitStakePubkey: splitAccount.publicKey,
        stakePubkey: actualStakeAccount,
      });
      return {splitTx:splitTx, stakeAccount:splitAccount}
    }

    const amountUserWantsToUntake = value * 10 ** account.decimals;
    const stakeBalance = account.lamports;

    const setSplit = ((account.status == 'active' || account.status == 'activating') && amountUserWantsToUntake != stakeBalance)
    
    let splitTx, stakeAccount
    if (setSplit){
      const result = split(new PublicKey(account.pubkey), amountUserWantsToUntake)
      splitTx = result.splitTx
      stakeAccount = result.stakeAccount
    } else {
      stakeAccount = new PublicKey(account.pubkey)
    }

    if(account.status == 'active' || account.status == 'activating'){
      // https://solanacookbook.com/references/staking.html#deactivate-stake
      const deactivateTx = StakeProgram.deactivate({
        stakePubkey: (setSplit ? stakeAccount.publicKey : stakeAccount) ,
        authorizedPubkey: publicKey,
      });


      if (setSplit){
      splitTx.add(deactivateTx)
      splitTx.feePayer = publicKey;
      splitTx.recentBlockhash = await (await connection.getRecentBlockhash()).blockhash;
      splitTx.partialSign(stakeAccount)
      }      

      return (setSplit ? splitTx : deactivateTx )   

    } else if (account.status == 'inactive'){
      // https://solanacookbook.com/references/staking.html#withdraw-stake
      const withdrawTx = StakeProgram.withdraw({
        stakePubkey: stakeAccount,
        authorizedPubkey: publicKey,
        toPubkey: publicKey,
        lamports: amountUserWantsToUntake,
      });

      return withdrawTx

    }
    else {   // account.status == 'deactivating'
      return null
    }
    
  }
