import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {Store} from 'core/store';
import {ActionTypes, LogAction} from 'lib/actions';
import {onActionFromRenderer} from 'lib/common';
import {getLogContent, getLogsDirectory, LogFileInfo} from 'lib/sync-logs/logger';


const shell = require('electron').shell;
const path = require('path');


export class LogsConnector {
    constructor (private store: Store, private appodealApi: AppodealApiService) {
        this.init();
    }

    init () {
        this.onAction = this.onAction.bind(this);
        onActionFromRenderer('logs', action => this.onAction(<LogAction>action));
    }

    onAction ({type, payload}: LogAction) {
        switch (type) {
        case ActionTypes.openLogFile:
            this.openLog(payload.account, payload.log);
            return payload;
        case ActionTypes.submitLogToAppodeal:
            return this.submitLog(payload.account, payload.log);
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

    async submitLog (account: AdMobAccount, log: LogFileInfo) {
        const rawLog = await getLogContent(account, log.uuid);
        return this.appodealApi.submitLog(account.id, log.uuid, rawLog);
    }

    async destroy () {
    }
}
