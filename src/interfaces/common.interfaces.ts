export interface UserAccount {
    id: string;
    email: string;
}

export interface AppodealAccountState extends UserAccount {
    active: boolean
}

export interface ExtractedAdmobAccount extends UserAccount {
}
