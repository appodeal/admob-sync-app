import {UserAccount} from 'interfaces/common.interfaces';


export interface AdMobAccount extends UserAccount {
    xsrfToken: string;
}

export interface AppodealAccount extends UserAccount {
    accounts: Array<AdMobAccount>;
}
