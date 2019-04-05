import {OnlineService} from 'core/appdeal-api/online.service';
import {Store} from 'core/store';
import {SyncHistory} from 'core/sync-apps/sync-history';
import {SyncService} from 'core/sync-apps/sync.service';
import {timeConversion} from 'lib/time';
import {observe} from 'mobx';


type Milliseconds = number;

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export class SyncScheduler {

    // oce a day at least

    private syncPeriod: Milliseconds = DAY_MS;

    private intervalID;
    private initialized = false;

    constructor (private syncService: SyncService, private store: Store, private online: OnlineService) {
        this.init();
    }

    log (...args) {
        console.log('[SyncScheduler] ', ...args);
    }

    init () {
        if (this.initialized) {
            this.log('already initialised');
            return;
        }
        this.initialized = true;
        this.runOnStart();
        this.runPeriodically();
        this.log('initialized');
    }

    runOnStart () {

        this.online.onceOnline().then(() => {

            let unsubscribe = observe(this.store.state, 'appodealAccount', () => {
                // after app started
                // once appodeal account loaded
                // run sync automatically
                if (this.store.state.appodealAccount) {
                    unsubscribe();
                    unsubscribe = null;
                    this.store.state.appodealAccount.accounts.forEach(adMobAccount => {
                        this.log(`App started. Run sync for Admob Account [${adMobAccount.id} ${adMobAccount.email}]`);
                        this.syncService.runSync(adMobAccount);
                    });
                }
            });
        });
    }

    runPeriodically () {
        this.intervalID = setInterval(() => {
            if (this.online.isOffline()) {
                // we are offline. do nothing unless get online
                return;
            }
            if (this.store.state.appodealAccount) {
                const {accounts} = this.store.state.appodealAccount;
                accounts.forEach(async adMobAccount => {
                    const lastSync = await SyncHistory.getLastSync(adMobAccount);
                    if (!lastSync) {

                        this.log(`Admob Account [${adMobAccount.id} ${adMobAccount.email}] has never synced. Run sync.`);
                        return this.syncService.runSync(adMobAccount);
                    }
                    const scienceLastSync = Date.now() - lastSync.getTime();
                    if (scienceLastSync > this.syncPeriod) {
                        this.log(`Admob Account [${adMobAccount.id} ${adMobAccount.email}] has synced more then ${
                            timeConversion(scienceLastSync)
                            }. Run sync.`
                        );
                        return this.syncService.runSync(adMobAccount);
                    }
                });
            }

        }, MINUTE_MS);
    }

    destroy () {
        clearInterval(this.intervalID);
    }


}
