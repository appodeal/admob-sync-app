import {UserAccount} from 'interfaces/common.interfaces';
import {AdMobAccount} from './admob-account.interface';


export interface AppodealAccount extends UserAccount {
    accounts: AdMobAccount[];
    adUnitNamePrefix: string;
    __typename: string;
}
