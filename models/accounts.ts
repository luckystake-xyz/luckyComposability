
export enum AccountTypes {
    Native = 'native',
    Spl = 'SPL',
    Staking = 'staking'
  }
  
  export enum AccountStatus {
    Active = 'active',
    Activating = 'activating',
    Deactivating = 'deactivating',
    Inactive = 'inactive',
    Loading  = 'loading'
  }
  
  export class Account{
    account: AccountTypes;
    symbol: string;
    icon: string;
    pubkey: string;
    lamports: number;
    decimals: number;
    voter: string;
    voterName: string;
    activationEpoch: number;
    type: string;
    status: AccountStatus;
    price: number;
    amountInUsd: number;
    constructor(account: AccountTypes, symbol: string, icon: string, pubkey: string, lamports: number, decimals: number, voter: string, activationEpoch: number, type: string, status: AccountStatus, price?: number, amountInUsd?: number){
      this.account = account;
      this.symbol = symbol;
      this.icon = icon;
      this.pubkey = pubkey;
      this.lamports = lamports;
      this.decimals = decimals;
      this.voter= voter;
      this.voterName= voter;
      this.activationEpoch = activationEpoch;
      this.type = type;
      this.status = status;
      this.price = price ? price : 0;
      this.amountInUsd = amountInUsd ? amountInUsd : 0;
    }
  }

  export default Account
