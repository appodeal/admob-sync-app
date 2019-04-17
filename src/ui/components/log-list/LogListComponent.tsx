import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {SyncHistoryInfo} from 'core/sync-apps/sync-history';
import {AppInfo, SyncInfo} from 'core/sync-apps/sync-stats';
import {SyncRunner} from 'core/sync-apps/sync.service';
import {ActionTypes, LogAction} from 'lib/actions';
import {classNames, singleEvent} from 'lib/dom';
import {sendToMain} from 'lib/messages';
import React from 'react';
import Accordion from 'react-tiny-accordion';
import Tooltip from 'react-tooltip-lite';
import {TextToClipboard} from 'ui/components/text-to-clipboard/TextToClipboardComponent';
import style from './LogList.scss';


interface LogListComponentProps {
    historyInfo: SyncHistoryInfo;
    admobAccount: AdMobAccount;
    appodealAccountId: string;
}

export class LogListComponent extends React.Component<LogListComponentProps> {

    static formatDate (timestamp) {
        const date = new Date();
        date.setTime(timestamp);
        return date.toLocaleString();
    }

    openLog (sync: SyncInfo) {
        return sendToMain('logs', {
            type: ActionTypes.openLogFile,
            payload: {
                account: this.props.admobAccount,
                syncId: sync.id
            }
        } as LogAction);
    }

    submitLogToAppodeal (sync: SyncInfo) {
        return sendToMain('logs', {
            type: ActionTypes.submitLogToAppodeal,
            payload: {
                account: this.props.admobAccount,
                syncId: sync.id,
                appodealAccountId: this.props.appodealAccountId
            }
        } as LogAction).then(() => {
            alert(`Log has been  sent to Appodeal. You can mention '${sync.id}' in support ticket.`);
        }).catch((e) => {
            console.error(e);
            alert(`Failed to sent log, ${e.errno === -2 ? 'file not found' : 'try again later.'}`);
        });
    }

    statusIcon (syncInfo: SyncInfo) {
        if (!syncInfo.endTs) {
            return <Tooltip content="Syncing...">
                <img className={style.syncing} src={require('../../assets/images/tray/win-syncing/syncing-1.svg')}/>
            </Tooltip>;
        }

        if (syncInfo.terminated) {
            return <Tooltip content="Sync was terminated"><img src={require('../../assets/images/sync-status/times-round.svg')}/></Tooltip>;
        }

        if (syncInfo.hasErrors) {
            return <Tooltip content="Synced with errors"><img src={require('../../assets/images/sync-status/warning-round.svg')}/></Tooltip>;
        }

        return <Tooltip content="Synced OK"><img src={require('../../assets/images/sync-status/check-round.svg')}/></Tooltip>;
    }

    runnerIcon (syncInfo: SyncInfo) {
        switch (syncInfo.runner) {
        case SyncRunner.SyncScheduler:
            return <Tooltip content="Run by schedule"><img src={require('../../assets/images/sync-status/clock.svg')}/></Tooltip>;
        case SyncRunner.User:
            return <Tooltip content="Run by user"><img src={require('../../assets/images/sync-status/user.svg')}/></Tooltip>;
        default:
            return '';
        }
    }

    affectedAppsCount (syncInfo: SyncInfo) {
        const count = syncInfo.affectedApps.created.length + syncInfo.affectedApps.updated.length + syncInfo.affectedApps.deleted.length;
        return count || '';
    }

    appList (title: string, list: AppInfo[]) {
        if (!list.length) {
            return '';
        }
        return <div className={style.applist}>
            {title}:
            <ul>
                {list.map(app => <li key={app.id}>[{TextToClipboard({text: String(app.id)})}] {TextToClipboard({text: app.name})}</li>)}
            </ul>
        </div>;
    }

    render (): React.ReactNode {

        return <Accordion className={style.list}>
            {this.props.historyInfo.syncs.map(
                syncInfo =>
                    <div key={syncInfo.id} data-header={
                        <div className={style.line}>
                            <div className={style.iconsGroup}>
                                <div className={style.icon}>
                                    {this.statusIcon(syncInfo)}
                                </div>
                                <div className={style.icon}>
                                    {this.runnerIcon(syncInfo)}
                                </div>
                                {this.affectedAppsCount(syncInfo)
                                    ? <Tooltip content={(<div>Affected apps count<br/> Click to see affected apps</div>)}>
                                        <div className={classNames(style.icon, style.count)}>
                                            {this.affectedAppsCount(syncInfo)}
                                        </div>
                                    </Tooltip>
                                    : <div className={classNames(style.icon, style.count)}></div>
                                }
                            </div>
                            <div className={style.time}>{LogListComponent.formatDate(syncInfo.startTs)}</div>
                            <div className={style.name}>{syncInfo.id}</div>
                            <div className={style.actions}>
                                <button onClick={singleEvent(() => this.openLog(syncInfo))} className={style['open-button']}>
                                    <img src={require('../../assets/images/eye.svg')}/>
                                </button>
                                <button onClick={singleEvent(() => this.submitLogToAppodeal(syncInfo))}
                                        className={style['submit-button']}
                                >Submit
                                </button>
                            </div>
                        </div>
                    }
                    >
                        {this.appList('Apps created', syncInfo.affectedApps.created)}
                        {this.appList('Apps updated', syncInfo.affectedApps.updated)}
                        {this.appList('Apps deleted', syncInfo.affectedApps.deleted)}
                    </div>
            )}
        </Accordion>;
    }
}
