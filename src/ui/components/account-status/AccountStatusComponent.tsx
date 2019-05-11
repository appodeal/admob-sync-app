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
        let {historyInfo, syncProgress} = this.props;

        if (historyInfo && historyInfo.admobAuthorizationRequired) {
            return <span className={style.warning}>Sign In required!</span>;
        }

        if (syncProgress) {
            // show warning
            switch (syncProgress.lastEvent) {
            case SyncEventsTypes.Started: {
                return 'Starting Sync';
            }
            case SyncEventsTypes.CalculatingProgress: {
                return 'Calculating progress';
            }
            default:
                return `Syncing ${syncProgress.completedApps + syncProgress.failedApps + 1}/${syncProgress.totalApps} apps...`;
            }
        }

        if (historyInfo && historyInfo.lastSync) {
            return <span>Synced: {(new Date(historyInfo.lastSync)).toLocaleString()}</span>;
        }

        // not synced yet
        return 'Sync Required';
    }
}
