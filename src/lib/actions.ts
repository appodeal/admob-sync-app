export enum ActionTypes {
    appodealSignIn = 'appodealSignIn',
    appodealSignOut = 'appodealSignOut',
    adMobAddAccount = 'adMobAddAccount',
    adMobRemoveAccount = 'adMobRemoveAccount'
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
