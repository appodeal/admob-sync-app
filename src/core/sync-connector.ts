import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {Store} from 'core/store';
import {SyncService} from 'core/sync-apps/sync.service';
import {Action, ActionTypes} from 'lib/actions';
import {onActionFromRenderer} from 'lib/common';


export class SyncConnector {


    constructor (private store: Store, private appodealApi: AppodealApiService, private syncService: SyncService) {
        this.init();
    }

    init () {
        this.onAction = this.onAction.bind(this);
        onActionFromRenderer('sync', action => this.onAction(action));
    }

    onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.runSync:
            if (this.syncService.canRun(payload)) {
                this.syncService.runSync(payload);
            }
            return;
        }
    }

    destroy () {

    }


}
