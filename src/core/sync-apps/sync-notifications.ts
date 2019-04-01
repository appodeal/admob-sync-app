import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {Store} from 'core/store';
import {Sync} from 'core/sync-apps/sync';
import {SyncEventsTypes} from 'core/sync-apps/sync.events';
import {Notification} from 'electron';
import {openSettingsWindow} from 'lib/settings';


export class SyncNotifications {

    private subs = [];

    constructor (private sync: Sync, private store: Store) {
        this.init();
    }

    init () {
        this.subs.push(
            this.sync.events.on(SyncEventsTypes.Started).subscribe(this.onStarted),
            this.sync.events.on(SyncEventsTypes.Stopped).subscribe(this.onStopped)
        );
    }

    onStarted = () => {
        this.showNotification('Sync started', `Sync for ${this.sync.adMobAccount.email} has been started`);
    };

    onStopped = () => {
        this.showNotification(
            'Sync finished',
            this.sync.hasErrors
                ? `Admob account ${this.sync.adMobAccount.email} has been synced with errors!`
                : `Admob account ${this.sync.adMobAccount.email} has been successfully synced!`,
            () => this.openAccount(this.sync.adMobAccount)
        );
    };

    onDestroy = () => {
        this.subs.forEach(sub => sub.unsubscribe());
    };

    destroy () {
        this.onDestroy();
    }

    openAccount (account: AdMobAccount) {
        this.store.selectAccount(account);
        return openSettingsWindow();
    }

    showNotification (
        title: string,
        message: string,
        onClick?: () => void
    ) {
        const notification = new Notification({
            title: title,
            body: message
        });
        if (onClick) {
            notification.once('click', function () {
                console.log('click notification');
                onClick();
            });
        }
        notification.show();
    }

}
