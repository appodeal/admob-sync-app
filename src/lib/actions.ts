export enum ActionTypes {
    appodealSignIn = 'appodealSignIn',
    appodealSignOut = 'appodealSignOut',
    adMobAddAccount = 'adMobAddAccount',
    adMobRemoveAccount = 'adMobRemoveAccount',
    openAdmobPage = 'openAdmobPage',
    changeAdmobAccount = 'changeAdmobAccount',
    updateAdmobCredentials = 'updateAdmobCredentials',
    fetchAppodealUser = 'fetchAppodealUser',
    loginToAdmob = 'loginToAdmob',
}


export interface Action {
    type: ActionTypes;
    payload: any;
}

export function action (type: ActionTypes, payload: any = null): Action {
    return {
        type,
        payload
    };
}
