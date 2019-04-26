import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {app} from 'electron';
import * as fs from 'fs-extra';
import {Action, ActionTypes} from 'lib/actions';
import {openClearDataWindow} from 'lib/ui-windows';
import {SyncService} from './sync-apps/sync.service';


export class DeleteDataConnector extends Connector {

    constructor (private store: Store, private syncService: SyncService) {
        super('delete-data');
    }

    async onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.showDeleteAllAccountsDataDialog:
            return openClearDataWindow();
        case ActionTypes.deleteAllAccountsData:
            await this.syncService.destroy();
            this.removeData();
            this.stopApp();

            return;
        default:
            return;
        }
    }

    removeData () {
        console.log('[DeleteDataConnector] removing local data');
        fs.removeSync(app.getPath('userData'));
        console.log('[DeleteDataConnector] local data removed');
    }

    stopApp () {
        app.exit(0);
    }
}
