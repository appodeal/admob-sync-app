import {AuthContext} from 'core/appdeal-api/auth-context';
import {Actions} from '../../common/actions';
import {App} from '../background';
import {auth} from '../utils/auth';
import {isUpdateRequired, patchMinimalVersion} from '../utils/minimal-version';
import {IJob} from './job.interface';


export class GetCurrentUserBackgroundJob implements IJob {

    constructor (private app: App) {
    }

    canRun = async (): Promise<boolean> => {
        return !this.app.loadingUser;
    };

    before = async () => {
        const {app} = this;
        app.loadingUser = this;
    };

    after = async () => {
        const {app} = this;
        app.loadingUser = null;
        console.debug('[GetCurrentUserJob] multicast state', JSON.parse(JSON.stringify(app.state)));
        chrome.runtime.sendMessage({type: Actions.extensionStateUpdated, state: app.state});
        if (app.state.tabId) {
            chrome.tabs.sendMessage(app.state.tabId, {type: Actions.extensionStateUpdated, state: app.state});
        }
    };

    async run () {
        await AuthContext.ready;
        console.debug('[GetCurrentUserJob] Auth Context ready');
        const {app} = this;
        const {api} = app;

        if (!api.authContext.isInitialized()) {
            api.authContext.init('accountId');
            console.debug('[GetCurrentUserJob] Auth Context is NOT initialized. Attempt to fetch tokens');
            const authSession = await auth(app).catch(e => {
                console.log('authSession', e);
                if (e && e.isCritical && !e.isCritical()) {
                    return null;
                }
                throw e;
            });
            if (authSession) {
                api.authContext.setTokensInfo(authSession);
                api.authContext.save();
            }
        }
        console.debug('[GetCurrentUserJob] Auth Context is initialized.');

        console.debug('[GetCurrentUserJob] start fetching current user.');
        app.state.currentUser = await api.fetchCurrentUser();
        console.debug('app.state.currentUser set', JSON.parse(JSON.stringify(app.state)));
        app.state.minimalVersion = patchMinimalVersion(await app.api.getMinimalAppVersion());
        app.state.updateRequired = isUpdateRequired(app.state.minimalVersion);
        console.debug('app.state.minimalVersion set', JSON.parse(JSON.stringify(app.state)));

        console.log('[GetCurrentUserJob] wait users activity');
    }

}
