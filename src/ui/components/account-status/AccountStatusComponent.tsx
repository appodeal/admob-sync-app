import {SyncProgress} from 'core/store';
import {SyncHistoryInfo} from 'core/sync-apps/sync-history';
import {SyncEventsTypes} from 'core/sync-apps/sync.events';
import React from 'react';
import style from './AccountStatus.scss';


interface Props {
    historyInfo: SyncHistoryInfo,
    syncProgress: SyncProgress
}


export class AccountStatusComponent extends React.Component<Props> {

    render (): React.ReactNode {
        if (this.props.historyInfo.admobAuthorizationRequired) {
            return <span className={style.warning}>Sign In required!</span>;
        }

        if (this.props.syncProgress) {
            // show warning
            switch (this.props.syncProgress.lastEvent) {
            case SyncEventsTypes.Started: {
                return 'Starting Sync';
            }
            case SyncEventsTypes.CalculatingProgress: {
                return 'Calculating progress';
            }
            default:
                return `Syncing ${this.props.syncProgress.completedApps + this.props.syncProgress.failedApps + 1}/${this.props.syncProgress.totalApps} apps...`;
            }
        }

        if (this.props.historyInfo.lastSync) {
            return <span>Synced: {(new Date(this.props.historyInfo.lastSync)).toLocaleString()}</span>;
        }

        // not synced yet
        return 'Sync Required';
    }
}
