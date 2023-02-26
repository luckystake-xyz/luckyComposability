import create, { State } from 'zustand'
import { AddressLookupTableAccount, Connection, PublicKey, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createBurnCheckedInstruction } from '@solana/spl-token2'; // @solana/spl-token@^0.2.0
import { Account, AccountTypes } from '../models/accounts'

class Quote{
  route: any;
  otherAmountThreshold: any;
  constructor(routes:any){
    this.route = routes ? routes[0] : ''; // ou mint
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
    var mint = ''
    if(account.account=='native'){ mint = 'So11111111111111111111111111111111111111112'} else {mint = account.pubkey}
    const  {data}  = await (
      await fetch(`https://quote-api.jup.ag/v4/quote?inputMint=${mint}&outputMint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&amount=${amount.toString()}&slippageBps=10&onlyDirectRoutes=true`)
    ).json()
    const quote = new Quote(data)
      set((s) => {
        s.quote = quote;
      })
}}))

async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): Promise<PublicKey> {
  return (await PublicKey.findProgramAddress(
      [
          walletAddress.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
  ))[0];
}

export async function swapTransaction(
    connection: Connection,
    publicKey: PublicKey,
    account: Account,
    route: Quote,
) {
  if(account.account == AccountTypes.Native || account.account == AccountTypes.Spl ){
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

    // construct the burn instruction
    const mintPubkey = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')
    const tokenAccountPubkey = await findAssociatedTokenAddress(publicKey, mintPubkey)

    // https://solanacookbook.com/references/token.html#how-to-burn-tokens
    const burnInstruction = createBurnCheckedInstruction(
      tokenAccountPubkey, // token account
      mintPubkey, // mint
      publicKey, // owner of token account
      route.otherAmountThreshold, // amount
      5 // decimals
    )

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
    message.instructions.push(burnInstruction)

    // compile the message and update the transaction
    transaction.message = message.compileToV0Message(addressLookupTableAccounts)
      
    return transaction
  }    
}
