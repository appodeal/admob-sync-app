import {AdMobAccount} from './admob-account.interface';


export interface AppodealAccount {
    id: string
    email: string;
    accounts: AdMobAccount[];
    __typename: string;
}
