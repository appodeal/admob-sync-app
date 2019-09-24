import {AdmobApiService} from 'core/admob-api/admob.api';
import {extractAccountInfo} from 'core/admob-api/extract-admob-account-info';
import {Sync} from 'core/sync-apps/sync';
import {SyncRunner} from 'core/sync-apps/sync-runner';
import {SyncEventsTypes, SyncReportProgressEvent} from 'core/sync-apps/sync.events';
import uuid from 'uuid';
import {deepClone} from '../../../src/lib/core';

import {Actions, TabJobs} from '../../common/actions';
import {Logger} from '../../common/logger';
import {App} from '../background';
import {getExtensionVersion} from '../utils/minimal-version';
import {notify} from '../utils/notifications';
import {IJob} from './job.interface';


export class RunSyncTabJob implements IJob {

    private id;
    private currentUser;
    private adMobAccount;
    private sync: Sync;
    private logger: Logger;
    private stateSnapshot;
    private syncProgress = {
        id: '',
        totalApps: 0,
        completedApps: 0,
        failedApps: 0,
        percent: 0,
        lastEvent: null,
        hasErrors: false,
        isTerminated: false
    };


    constructor (private  app: App) {}

    canRun = async (): Promise<boolean> => {
        return !this.app.runningSync;
    };

    async before () {
        this.app.runningSync = this;
        this.logger = new Logger();
    }

    async after () {
        const api = this.app.api;
        const {logger, adMobAccount, sync, id} = this;

        if (this.app.runningSync === this) {
            this.app.runningSync = null;
            this.app.state.tabsJob = TabJobs.Idle;
        }

        logger.info('Admob AdUnits and Apps');
        logger.info(JSON.stringify(sync.context.getAdmobState()));
        await api.submitLog(adMobAccount.id, id, logger.getAsText()).catch(e => {
            console.error('Failed to submit log', e);
        });
        logger.clean();
    }

    async run () {

        const logger = this.logger;
        const api = this.app.api;

        this.stateSnapshot = deepClone(this.app.state);

        logger.info('stateSnapshot', this.stateSnapshot);
        const currentUser = this.currentUser = this.stateSnapshot.currentUser;

        const id = this.id = uuid.v4();

        const adMobApi = new AdmobApiService(fetch.bind(globalThis), console);
        const extractedAdmobAccount = extractAccountInfo(await adMobApi.fetchHomePage().then(r => r.text()));
        const adMobAccount = this.adMobAccount = currentUser.accounts.find(
            acc => acc.email.toLowerCase() === this.stateSnapshot.tabAdmobAccountEmail.toLowerCase());

        logger.info(`Sync with extension. Version ${getExtensionVersion()}`);


        if (!adMobAccount) {
            logger.warn(`unknown Admob account`, extractedAdmobAccount);
            // unknown account
            this.notify(
                'Unknown account.',
                `You have signed in to account which is not connected to Appodeal. If you want to continue with this account click extension icon, then click "Add another Admob account" button.`
            );
            return;
        }

        if (adMobAccount.id !== extractedAdmobAccount.id) {
            // fix ID
            // some accounts have invalid accountID
            logger.warn(`account with wrong accountID found. ${adMobAccount.id} replaces with actual value ${extractedAdmobAccount.id}`);
            await api.setAdmobAccountId(adMobAccount.email, extractedAdmobAccount.id);
            adMobAccount.id = extractedAdmobAccount.id;
        }

        if (!adMobAccount.isReadyForReports) {
            // setup for account required
            logger.warn(`Setup required.`, adMobAccount);
            this.notify(
                'Setup required.',
                `To sync adunits with this account you have to enable reporting first. Please Click Extension icon, then click "Enable reporting" button near this account.`
            );
            return;
        }

        const sync = this.sync = new Sync(
            adMobApi,
            api,
            adMobAccount,
            currentUser,
            logger,
            id,
            SyncRunner.User
        );


        sync.events.on().subscribe(event => {
            try {
                this.updateSyncProgress(event);
            } catch (e) {
                console.error(e);
            }
        });

        return sync.run();
    }

    updateSyncProgress (event) {

        this.syncProgress.lastEvent = event;
        switch (event.type) {
        case SyncEventsTypes.ReportProgress:
            const pEvent = <SyncReportProgressEvent>event;
            this.syncProgress.id = event.id;
            this.syncProgress.totalApps = event.total;
            this.syncProgress.completedApps = event.synced;
            this.syncProgress.failedApps = event.failed;
            this.syncProgress.percent = (pEvent.synced + pEvent.failed) / pEvent.total * 100;
            this.reportProgressToTab();
            break;
        case SyncEventsTypes.Stopped:
            const {adMobAccount, currentUser} = this;
            this.syncProgress.hasErrors = event.hasErrors;
            this.syncProgress.isTerminated = event.terminated;
            if (event.hasErrors) {
                this.notify('Sync has finished with Errors', `While sync Admob ${adMobAccount.email} account some error occurred.`);
            } else if (event.terminated) {
                this.notify('Sync has been canceled', `${adMobAccount.email} sync has been canceled.`);
            } else {
                this.notify(
                    'Sync has finished',
                    `Appodeal's ${currentUser.email} and Admob ${adMobAccount.email} accounts are in sync.`
                );
            }
            break;
        default:
            this.reportProgressToTab();
            break;
        }
    }

    notify (title, message) {
        if (this.app.state.tabId) {
            chrome.tabs.sendMessage(this.app.state.tabId, {type: Actions.syncProgressFinishMessage, message: `${title} ${message}`});
        }
        return setTimeout(() => notify(title, message), 1000);
    }

    reportProgressToTab () {
        if (this.app.state.tabId) {
            chrome.tabs.sendMessage(this.app.state.tabId, {type: Actions.syncProgressUpdated, syncProgress: this.syncProgress});
        }
    }


    cancel () {
        this.app.runningSync = null;
        return this.sync.stop('Canceled By User');
    }
}
