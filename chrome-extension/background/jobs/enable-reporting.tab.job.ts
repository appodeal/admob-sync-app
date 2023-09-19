import {Actions, TabJobs} from '../../common/actions';
import {App} from '../background';
import {legacyOnOpenAdmobPage, legacyWebNavigationHandler} from '../legacy/reporting';
import {IJob} from './job.interface';


export class EnableReportingTabJob implements IJob {

    private isDone = false;

    constructor (private app: App) {
    }

    canRun = async (): Promise<boolean> => {
        return !this.app.enablingReports;
    };

    async before () {
        this.app.enablingReports = this;
        chrome.webNavigation.onCompleted.addListener(this.onWebNavigationCompleted);
        // set interval is required here to prevent background script from sleeping
    }

    async after () {

        chrome.webNavigation.onCompleted.removeListener(this.onWebNavigationCompleted);
        this.app.enablingReports = null;
        this.app.state.tabsJob = TabJobs.Idle;
    }


    onWebNavigationCompleted = (details) => {
        this.app.sentry.withScope(scope => {
            const {app} = this;
            scope.setExtra('navigationDetails', details);

            if (app.state.tabId !== details.tabId) {
                console.debug(`[webNavigation] Ignore event. activeTabId ${app.state.tabId} ignore event from ${details.tabId} tab`);
                return;
            }
            return legacyWebNavigationHandler(details);
        });
    };


    async run () {
        return new Promise(resolve => {
            if (this.isDone) {
                resolve();
            }
            this.done = resolve;
            legacyOnOpenAdmobPage(this.app.state.tabId);
        });
    }

    done = () => {
        this.isDone = true;
    };

    async onUpdateAdmobAccountCredential (request) {
        const {app} = this;

        if (!app.state.currentUser.accounts.some(
            admobAcc => admobAcc.email.toLowerCase() === app.state.tabAdmobAccountEmail.toLowerCase())) {
            await app.api.addAdMobAccount({id: app.state.tabAdmobAccountId, email: app.state.tabAdmobAccountEmail});
            app.state.currentUser = await app.api.fetchCurrentUser();
        }

        const oAuthUrl = await app.api.setAdMobAccountCredentials(
            app.state.tabAdmobAccountId,
            request.client_id,
            request.client_secret
        );

        chrome.tabs.sendMessage(app.state.tabId, {type: Actions.updateAdmobAccountCredentialsUpdated, oAuthUrl: oAuthUrl});
        this.done();
    }

}
