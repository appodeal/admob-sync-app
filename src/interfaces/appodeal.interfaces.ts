import {UserAccount} from 'interfaces/common.interfaces';


export interface AdmobAccount extends UserAccount {
    xsrfToken: string;
}

