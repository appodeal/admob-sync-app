import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {app} from 'electron';
import {Action, ActionTypes} from 'lib/actions';
import {openClearDataWindow} from 'lib/ui-windows';
import {SyncService} from './sync-apps/sync.service';
import BrowserWindow = Electron.BrowserWindow;


export class DeleteDataConnector extends Connector {

    openedWindow?: BrowserWindow;

    constructor (private store: Store, private syncService: SyncService) {
        super('delete-data');
    }

    async onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.showDeleteAllAccountsDataDialog:
            return this.openedWindow = await openClearDataWindow();
        case ActionTypes.hideDeleteAllAccountsDataDialog:
            return this.closeActiveWindow();
        case ActionTypes.deleteAllAccountsData:
            await this.syncService.destroy();
            this.restartWithRelaunchCmd();

            return;
        default:
            return;
        }
    }

    closeActiveWindow () {
        if (this.openedWindow) {
            this.openedWindow.close();
            this.openedWindow = null;
        }
    }

    restartWithRelaunchCmd () {
        console.log('run relaunch');
        app.relaunch({args: process.argv.slice(1).concat(['--clearData'])});
        app.exit(0);
    }
}
