import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {action, ActionTypes, LogAction} from 'lib/actions';
import {sendToMain} from 'lib/messages';
import {LogFileInfo} from 'lib/sync-logs/logger';
import React from 'react';

import style from './LogList.scss';


interface LogListComponentProps {
    admobAccount: AdMobAccount;
    logs: LogFileInfo[];
    appodealAccountId: string;
}

export class LogListComponent extends React.Component<LogListComponentProps> {

    static formatDate (timestamp) {
        const date = new Date();
        date.setTime(timestamp);
        return date.toLocaleString();
    }

    openLog (log: LogFileInfo) {
        sendToMain('logs', {
            type: ActionTypes.openLogFile,
            payload: {
                account: this.props.admobAccount,
                log
            }
        } as LogAction);
    }

    submitLogToAppodeal (log: LogFileInfo) {
        sendToMain('logs', action(ActionTypes.submitLogToAppodeal, {
            account: this.props.admobAccount,
            log,
            appodealAccountId: this.props.appodealAccountId
        })).then(() => {
            alert(`Log has been  sent to Appodeal. You can mention '${log.uuid}' in support ticket.`);
        }).catch((e) => {
            console.error(e);
            alert(`Failed to sent log, try again later.`);
        });
    }

    render (): React.ReactNode {
        return <div className={style.list}>
            {this.props.logs.map(
                log => <div className={style.line} key={log.uuid}>
                    <div className={style.time}>{LogListComponent.formatDate(log.ctime)}</div>
                    <div className={style.name}>{log.fileName}</div>
                    <div className={style.actions}>
                        <button onClick={() => this.openLog(log)} className={style['open-button']}>View Log</button>
                        <button onClick={() => this.submitLogToAppodeal(log)} className={style['submit-button']}>Submit</button>
                    </div>
                </div>
            )}
        </div>;
    }
}
