import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {SyncService} from 'core/sync-apps/sync.service';
import {Action, ActionTypes} from 'lib/actions';
import {SyncRunner} from './sync-apps/sync-runner';


export class SyncConnector extends Connector {


    constructor (private store: Store, private syncService: SyncService) {
        super('sync');
    }

    async onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.runSync:
            if (this.syncService.canRun(payload.adMobAccount)) {
                return this.syncService.runSync(payload.appodealAccountId, payload.adMobAccount, SyncRunner.User);
            }
            return;
        default:
            return;
        }
    }
}
