import {AdmobAccount} from 'interfaces/appodeal.interfaces';
import {LogFileInfo} from 'lib/sync-logs/logger';


export enum ActionTypes {
    appodealSignIn = 'appodealSignIn',
    appodealSignOut = 'appodealSignOut',
    adMobAddAccount = 'adMobAddAccount',
    runSync = 'RunSync',
    openAdmobPage = 'openAdmobPage',
    selectAdmobAccount = 'selectAdmobAccount',
    updateAdmobCredentials = 'updateAdmobCredentials',
    fetchAppodealUser = 'fetchAppodealUser',
    loginToAdmob = 'loginToAdmob',

    openLogFile = 'openLogFile',
    submitLogToAppodeal = 'submitLogToAppodeal'
}


export interface Action {
    type: ActionTypes;
    payload: any;
}


export interface LogAction extends Action {
    type: ActionTypes.openLogFile | ActionTypes.submitLogToAppodeal,
    payload: {
        account: AdmobAccount,
        log: LogFileInfo
    }
}


export function action (type: ActionTypes, payload: any = null): Action {
    return {
        type,
        payload
    };
}
