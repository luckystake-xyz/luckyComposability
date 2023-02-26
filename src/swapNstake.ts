import create, { State } from 'zustand'
import { Connection, Keypair, PublicKey, SystemProgram, StakeProgram, Authorized, VersionedTransaction, AddressLookupTableAccount, TransactionMessage } from "@solana/web3.js";
import { Account, AccountTypes } from '../models/accounts'

class Quote{
  route: any;
  otherAmountThreshold: any;
  constructor(routes:any){
    this.route = routes ? routes[0] : '';
    this.otherAmountThreshold = routes && routes[0] ? routes[0].otherAmountThreshold : '' ;
  }
}

interface UserQuote extends State {
  quote: any;
  account: any;
  getQuote: (amount: any, account: any) => void
}

export const useQuoteStore = create<UserQuote>((set, _get) => ({
  quote: [],
  account: [],
  getQuote: async (amount, account) => {
    amount = Number(amount) * 10**account?.decimals
    if(account?.account==AccountTypes.Native){ 
      var quote = new Quote([{otherAmountThreshold: amount}])
    } 
    else {
      const mint = account?.pubkey
      const  {data}  = await (
        await fetch(`https://quote-api.jup.ag/v4/quote?inputMint=${mint}&outputMint=So11111111111111111111111111111111111111112&amount=${amount.toString()}&slippageBps=21&onlyDirectRoutes=true`)
      ).json()
      var quote = new Quote(data)
    }
    set((s) => {
      s.quote = quote;
    })
}}))

export async function stakeTransaction(
    connection: Connection,
    publicKey: PublicKey,
    account: Account,
    route: Quote,
   
  ) {
    const amountToStake = route.otherAmountThreshold ;
    const stakeAccount = Keypair.generate();

    // https://solanacookbook.com/references/staking.html#create-stake-account
    let createStakeAccountTx = StakeProgram.createAccount({
      authorized: new Authorized(publicKey, publicKey), // Here we set two authorities: Stake Authority and Withdrawal Authority. Both are set to our wallet.
      fromPubkey: publicKey,
      lamports: amountToStake,
      stakePubkey: stakeAccount.publicKey,
    });

    //https://solanacookbook.com/references/staking.html#delegate-stake
    const delegateTx = StakeProgram.delegate({
      stakePubkey: stakeAccount.publicKey,
      authorizedPubkey: publicKey,
      votePubkey: new PublicKey("Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9"),
    });

    if(account.account == AccountTypes.Spl ){
      const transactions = await (
        await fetch('https://quote-api.jup.ag/v4/swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: route,
            userPublicKey: publicKey.toString(),  
          })
        })
      ).json()
        
      const { swapTransaction } = transactions
  
      // https://docs.jup.ag/integrating-jupiter/composing-with-versioned-transactions
      // deserialize the transaction
      const swapTransactionFromJupiterAPI = swapTransaction
      const swapTransactionBuf = Buffer.from(swapTransactionFromJupiterAPI, 'base64')
      var transaction = VersionedTransaction.deserialize(swapTransactionBuf)
        
      // construct the referral fee transfer instruction (0.2%)
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey('xLuck1NSnwNVRGWsawG5P51bqqcLuUW3YS52rfccF8w'),
        lamports: Number((route.otherAmountThreshold * 0.002).toFixed(0)),
      })
  
      // get address lookup table accounts
      const addressLookupTableAccounts = await Promise.all(
        transaction.message.addressTableLookups.map(async (lookup) => {
          return new AddressLookupTableAccount({
            key: lookup.accountKey,
            state: AddressLookupTableAccount.deserialize(await connection.getAccountInfo(lookup.accountKey).then((res) => res.data)),
           })
        }))
  
      // decompile transaction message and add transfer instruction
      var message = TransactionMessage.decompile(transaction.message,{addressLookupTableAccounts: addressLookupTableAccounts})
      message.instructions.push(transferInstruction)
      message.instructions.push(createStakeAccountTx.instructions[0])
      message.instructions.push(createStakeAccountTx.instructions[1])
      message.instructions.push(delegateTx.instructions[0])
      
      // compile the message and update the transaction
      transaction.message = message.compileToV0Message(addressLookupTableAccounts)
      transaction.sign([stakeAccount]) 
      return transaction
    }    

    if(account.account == AccountTypes.Native){

      /* // To improve user experience, rentExemptReserve is ignored
      const minimumRent = await connection.getMinimumBalanceForRentExemption(
        StakeProgram.space
      );
      const amountToStake = minimumRent + amountUserWantsToStake;
      */    
  
      const transaction = createStakeAccountTx.add(delegateTx.instructions[0]);

      transaction.feePayer = publicKey;
      transaction.recentBlockhash = await (await connection.getRecentBlockhash()).blockhash;

      transaction.partialSign(stakeAccount);
  
      return transaction
    }
    
  }
