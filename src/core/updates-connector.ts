import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {action, Action, ActionTypes} from 'lib/actions';
import {AppPreferences} from 'lib/app-preferences';
import {UpdatePeriod, UpdatesService} from 'lib/updates';


export class UpdatesConnector extends Connector {
    removeCheckListener: Function;

    constructor (private store: Store, private updates: UpdatesService) {
        super('updates');
        let listener = () => {
            this.checkForUpdates(true, 'notification');
        };
        this.updates.on('check', listener);
        this.removeCheckListener = () => this.updates.off('check', listener);
    }

    async onAction ({type, payload}: Action): Promise<any> {
        switch (type) {
        case ActionTypes.downloadDist:
            return this.updates.availableDist.download();
        case ActionTypes.getDist:
            return this.updates.availableDist;
        case ActionTypes.viewReleaseNotes:
            return this.updates.availableDist.viewReleaseNotes();
        case ActionTypes.checkUpdates:
            let available = await this.updates.check();
            this.store.patchPreferences({
                updates: {
                    lastCheck: new Date().toISOString(),
                    availableVersion: available ? this.updates.availableDist.version: null
                }
            });
            if (available) {
                if (payload.mode === 'modal') {
                    this.updates.availableDist.showUpdateDialog();
                } else if (payload.mode === 'notification') {
                    this.updates.availableDist.notify();
                }
            } else if (!payload.updateOnly)  {
                this.updates.showNoUpdatesDialog();
            }
            return;
        case ActionTypes.updatesCheckPeriod:
            await this.store.patchPreferences({
                updates: {
                    checkPeriod: payload.period,
                    customOptions: payload.customOptions
                }
            });
            let {checkPeriod, customOptions} = this.store.state.preferences.updates;
            return this.updates.schedule(checkPeriod, {...customOptions});
        default:
            return null;
        }
    }


    checkForUpdates (updateOnly: boolean, mode: 'modal' | 'notification' | 'none'): Promise<void> {
        return this.onAction(action(ActionTypes.checkUpdates, {
            updateOnly,
            mode
        }));
    }

    runScheduler (checkPeriod: UpdatePeriod, customOptions: AppPreferences['updates']['customOptions']) {
        return this.onAction(action(ActionTypes.updatesCheckPeriod, {
            period: checkPeriod,
            customOptions
        }))
    }

    async destroy () {
        super.destroy();
        this.removeCheckListener();
    }

}
