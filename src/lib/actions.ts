import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';


export enum ActionTypes {
    appodealSignIn = 'appodealSignIn',
    adMobReSignIn = 'appodealReSignIn',
    appodealSignOut = 'appodealSignOut',
    appodealPing = 'appodealPing',
    adMobAddAccount = 'adMobAddAccount',
    adMobSetupTutorial = 'adMobSetupTutorial',
    adMobSetCredentials = 'adMobSetCredentials',
    runSync = 'RunSync',
    openAdmobPage = 'openAdmobPage',
    selectAccount = 'selectAdmobAccount',
    selectAppodealAccount = 'selectAppodealAccount',
    openLogFile = 'openLogFile',
    submitLogToAppodeal = 'submitLogToAppodeal',
    getStore = 'getStore',
    checkUpdates = 'checkUpdates',
    downloadDist = 'downloadDist',
    getDist = 'getDist',
    viewReleaseNotes = 'viewReleaseNotes',
    updatesCheckPeriod = 'updatesCheckPeriod',
    addAppodealAccount = 'addAppodealAccount',
    manageAppodealAccounts = 'manageAppodealAccounts'
}


export interface Action {
    type: ActionTypes;
    payload: any;
}


export interface LogAction extends Action {
    type: ActionTypes.openLogFile | ActionTypes.submitLogToAppodeal,
    payload: {
        account: AdMobAccount,
        syncId: string,
        appodealAccountId: string
    }
}


export function action (type: ActionTypes, payload: any = {}): Action {
    return {
        type,
        payload
    };
}
