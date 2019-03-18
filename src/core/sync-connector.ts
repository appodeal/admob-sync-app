import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {SyncService} from 'core/sync-apps/sync.service';
import {Action, ActionTypes} from 'lib/actions';


export class SyncConnector extends Connector {


    constructor (private store: Store, private appodealApi: AppodealApiService, private syncService: SyncService) {
        super('sync');
    }

    async onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.runSync:
            if (this.syncService.canRun(payload)) {
                this.syncService.runSync(payload);
            }
            return;
        }
    }

    destroy () {
        super.destroy();
    }
}
