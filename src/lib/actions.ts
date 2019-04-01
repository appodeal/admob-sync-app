import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {LogFileInfo} from 'lib/sync-logs/logger';


export enum ActionTypes {
    appodealSignIn = 'appodealSignIn',
    appodealReSignIn = 'appodealReSignIn',
    appodealSignOut = 'appodealSignOut',
    adMobAddAccount = 'adMobAddAccount',
    adMobSetupTutorial = 'adMobSetupTutorial',
    adMobSetCredentials = 'adMobSetCredentials',
    runSync = 'RunSync',
    openAdmobPage = 'openAdmobPage',
    selectAdmobAccount = 'selectAdmobAccount',
    openLogFile = 'openLogFile',
    submitLogToAppodeal = 'submitLogToAppodeal',
    getStore = 'getStore',
    checkUpdates = 'checkUpdates',
    downloadDist = 'downloadDist',
    getDist = 'getDist',
    viewReleaseNotes = 'viewReleaseNotes',
    updatesCheckPeriod = 'updatesCheckPeriod'
}


export interface Action {
    type: ActionTypes;
    payload: any;
}


export interface LogAction extends Action {
    type: ActionTypes.openLogFile | ActionTypes.submitLogToAppodeal,
    payload: {
        account: AdMobAccount,
        log: LogFileInfo
    }
}


export function action (type: ActionTypes, payload: any = null): Action {
    return {
        type,
        payload
    };
}
