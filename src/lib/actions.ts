import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';


export enum ActionTypes {
    appodealSignIn = 'appodealSignIn',
    adMobReSignIn = 'appodealReSignIn',
    appodealSignOut = 'appodealSignOut',
    appodealFetchUsers = 'appodealFetchUsers',
    appodealPing = 'appodealPing',
    adMobAddAccount = 'adMobAddAccount',
    adMobSetupTutorial = 'adMobSetupTutorial',
    adMobSetCredentials = 'adMobSetCredentials',
    adMobSetupAccount = 'adMobSetupAccount',
    adMobSetupState = 'adMobSetupState',
    adMobCancelSetup = 'adMobCancelSetup',
    adMobShowSetup = 'adMobShowSetup',
    runSync = 'RunSync',
    openAdmobPage = 'openAdmobPage',
    selectAccount = 'selectAdmobAccount',
    hideDeleteAllAccountsDataDialog = 'hideDeleteAllAccountsDataDialog',
    showDeleteAllAccountsDataDialog = 'showDeleteAllAccountsDataDialog',
    deleteAllAccountsData = 'deleteLocalData',
    selectAppodealAccount = 'selectAppodealAccount',
    openLogFile = 'openLogFile',
    submitLogToAppodeal = 'submitLogToAppodeal',
    getStore = 'getStore',
    toggleDevMode = 'toggleDevMode',
    checkUpdates = 'checkUpdates',
    downloadDist = 'downloadDist',
    getDist = 'getDist',
    viewReleaseNotes = 'viewReleaseNotes',
    updatesCheckPeriod = 'updatesCheckPeriod',
    addAppodealAccount = 'addAppodealAccount',
    manageAppodealAccounts = 'manageAppodealAccounts',
    packageInfo = 'packageInfo',
    openExternalUrl = 'openExternalUrl'
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
