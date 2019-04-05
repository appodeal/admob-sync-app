import {AppodealApi} from 'core/appdeal-api/appodeal-api.factory';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {ActionTypes, LogAction} from 'lib/actions';
import {getLogContent, getLogsDirectory, LogFileInfo} from 'lib/sync-logs/logger';


const shell = require('electron').shell;
const path = require('path');


export class LogsConnector extends Connector {
    constructor (private store: Store, private appodealApi: AppodealApi) {
        super('logs');
    }

    async onAction ({type, payload}: LogAction) {
        switch (type) {
        case ActionTypes.openLogFile:
            this.openLog(payload.account, payload.log);
            return payload;
        case ActionTypes.submitLogToAppodeal:
            return this.submitLog(payload.account, payload.log, payload.appodealAccountId);
        }

    }

    openLog (account: AdMobAccount, log: LogFileInfo) {
        console.info('openLog', log);
        try {
            shell.openItem(path.join(getLogsDirectory(account), log.fileName));
        } catch (e) {
            console.error(e);
        }
    }

    async submitLog (account: AdMobAccount, log: LogFileInfo, appodealAccountId: string) {
        const rawLog = await getLogContent(account, log.uuid);
        return this.appodealApi.getFor(appodealAccountId).submitLog(account.id, log.uuid, rawLog);
    }
}
