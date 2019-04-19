import {Store} from 'core/store';
import {AppTray} from 'lib/app-tray';
import {Lambda, observe} from 'mobx';


enum Icons {
    SyncInProgress = 'syncing',
    ReLoginRequired = 'userActionRequired',
    EveryThingSynced = 'synced',
    Default = 'defaultIcon'

}

export class TrayIcon {

    private updateID;
    private currentIcon: Icons = Icons.Default;
    private sub: Lambda;

    constructor (private store: Store, private appTray: AppTray) {
        this.listenStatusChanges();
    }

    listenStatusChanges () {
        this.sub = observe(this.store.state, (change) => {
            if (['account', 'history', 'syncProgress'].includes(change.name)) {
                this.checkIcon();
            }
        });
        this.checkIcon();
    }

    checkIcon () {
        if (this.updateID) {
            return;
        }
        this.updateID = setTimeout(() => {
            this.updateID = null;
            this.updateIcon();
        }, 500);
    };

    update (newIcon, updater: Function) {
        if (newIcon === this.currentIcon) {
            return;
        }
        this.currentIcon = newIcon;
        updater();
    }

    updateIcon () {
        if (this.store.isSyncing()) {
            return this.update(Icons.SyncInProgress, () => this.appTray.setProgressIcon());
        }
        if (this.store.hasWarnings()) {
            return this.update(Icons.ReLoginRequired, () => this.appTray.setWarningIcon());
        }
        if (this.store.isEachAccountSynced()) {
            return this.update(Icons.EveryThingSynced, () => this.appTray.setSyncedIcon());
        }
        return this.update(Icons.Default, () => this.appTray.setDefaultIcon());
    }

    async destroy () {
        clearTimeout(this.updateID);
        if (this.sub) {
            this.sub();
        }
    };


}
