import {UserAccount} from 'interfaces/common.interfaces';


export interface AdmobAccount extends UserAccount {
    xsrfToken: string;
}

export interface AppodealAccount extends UserAccount {
    accounts: Array<AdmobAccount>;
}
