import {AppodealApi} from 'core/appdeal-api/appodeal-api.factory';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {shell} from 'electron';
import {ActionTypes, LogAction} from 'lib/actions';
import {getLogContent, logFilePathName} from 'lib/sync-logs/logger';


export class LogsConnector extends Connector {
    constructor (private store: Store, private appodealApi: AppodealApi) {
        super('logs');
    }

    async onAction ({type, payload}: LogAction) {
        switch (type) {
        case ActionTypes.openLogFile:
            this.openLog(payload.account, payload.syncId);
            return payload;
        case ActionTypes.submitLogToAppodeal:
            return this.submitLog(payload.account, payload.syncId, payload.appodealAccountId);
        }

    }

    openLog (account: AdMobAccount, syncId: string) {
        console.info('openLog', syncId);
        try {
            shell.openPath(logFilePathName(account, syncId));
        } catch (e) {
            console.error(e);
        }
    }

    async submitLog (account: AdMobAccount, syncId: string, appodealAccountId: string) {
        const rawLog = await getLogContent(account, syncId);
        return this.appodealApi.getFor(appodealAccountId).submitLog(account.id, syncId, rawLog);
    }
}
