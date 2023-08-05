import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction} from "@solana/web3.js";
import { Marinade, MarinadeUtils, MarinadeConfig } from '@marinade.finance/marinade-ts-sdk'
import { Account, AccountTypes } from '../models/accounts'
import create, { State } from 'zustand'

export async function directedTransaction(
    connection: Connection,
    publicKey: PublicKey,
    userStake: any) {
        const validatorVoteAddress = new PublicKey("Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9");

        if(userStake && userStake?.validatorVoteAccount != "Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9"){

        } else if (publicKey && userStake == null) {

        }
}

class Quote{
    route: any;
    otherAmountThreshold: any;
    constructor(routes:any){
      this.route = routes ? routes : '';
      this.otherAmountThreshold = routes ? routes.otherAmountThreshold : '' ;
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
      amount = Number(amount * 10**account?.decimals).toFixed(0)
      if(account?.account==AccountTypes.Native){ 
        var quote = new Quote({otherAmountThreshold: amount})
        console.log(quote)
      } 
      else {
        const mint = account?.pubkey
        const  data  = await (
          await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${mint}&outputMint=So11111111111111111111111111111111111111112&amount=${amount.toString()}&slippageBps=10`)
        ).json()
        var quote = new Quote(data)
        console.log(quote)
      }
      set((s) => {
        s.quote = quote;
      })
  }}))

export async function stakeTransaction(
    connection: Connection,
    publicKey: PublicKey,
    account: Account,
    value: number,
  ) {
    //const MY_REFERRAL_ACCOUNT = "...." // <-- your referral account
    const config = new MarinadeConfig({
    connection: connection,
    publicKey: publicKey,
    //referralCode: new web3.PublicKey(MY_REFERRAL_ACCOUNT),
    })
    const marinade = new Marinade(config)
    
    const validatorVoteAddress = new PublicKey("Luck3DN3HhkV6oc7rPQ1hYGgU3b5AhdKW9o1ob6AyU9");
  
    if(account.account == AccountTypes.Native){

        const { transaction } = await marinade.deposit(
            MarinadeUtils.solToLamports(value),
            { directToValidatorVoteAddress: validatorVoteAddress }
          )
  
      return transaction
    } else if (account.account == AccountTypes.Staking){

        let stakeAccount = new PublicKey(account.pubkey)

        const { transaction } = await marinade.depositStakeAccount(
            stakeAccount,
            { directToValidatorVoteAddress: validatorVoteAddress }
        )

        return transaction
    } else {
        console.log(MarinadeUtils.solToLamports(value))
        const { transaction } = await marinade.deposit(
            MarinadeUtils.solToLamports(value),
            { directToValidatorVoteAddress: validatorVoteAddress }
          )
  
      return transaction
    }
  }

  export async function instantUnstakeTransaction(
    connection: Connection,
    publicKey: PublicKey,
    account: Account,
    value: number, 
    route: Quote,
  ) {
        // https://station.jup.ag/docs/apis/swap-api
        const transactions = await (
          await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              quoteResponse: route,
              userPublicKey: publicKey.toString(),  
            })
          })
        ).json()

        const { swapTransaction } = transactions
        console.log(swapTransaction)

        // deserialize the transaction
        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
        console.log(transaction);
    
        return transaction
    }

export async function unstakeTransaction(
    connection: Connection,
    publicKey: PublicKey,
    account: any,
    value: number,  
) {
    //const MY_REFERRAL_ACCOUNT = "...." // <-- your referral account
    const config = new MarinadeConfig({
        connection: connection,
        publicKey: publicKey,
        //referralCode: new web3.PublicKey(MY_REFERRAL_ACCOUNT),
        })
    const marinade = new Marinade(config)

    const { transaction, ticketAccountKeypair } = await marinade.orderUnstake(
        MarinadeUtils.solToLamports(value)
      )
    const ticketAccount = ticketAccountKeypair.publicKey

    return {transaction, ticketAccount}
}
