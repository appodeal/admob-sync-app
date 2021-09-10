import * as Sentry from '@sentry/electron';
import {Severity} from '@sentry/electron';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {SyncHistory} from 'core/sync-apps/sync-history';
import {BrowserWindow, Session, session, shell} from 'electron';
import {ExtractedAdmobAccount} from 'interfaces/common.interfaces';
import {nodeFetch} from 'lib/fetch';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import {retry} from 'lib/retry';
import {openWindow, waitForNavigation} from 'lib/window';
import uuid from 'uuid';
import {removeSession} from '../../lib/sessions';
import {cutElectronFromUserAgent} from '../../lib/user-agent';
import {extractAccountInfo} from './extract-admob-account-info';


export namespace AdMobSessions {

    const sessionsFileName = 'admob-sessions-ff';

    let SESSIONS: Map<string, string>;

    function sessionFromPartition (sessionID: string) {
        const sess = session.fromPartition(`persist:${sessionID}`);
        sess.setUserAgent(cutElectronFromUserAgent(sess.getUserAgent()));
        return sess;
    }

    export function init () {
        return getJsonFile(sessionsFileName).then(sessions => {
            SESSIONS = sessions ? new Map(Object.entries(sessions)) : new Map();
        });
    }

    /**
     * for dev purposes
     */
    export function clearAllSessions () {
        return Promise.all([...SESSIONS.values()].map((sessionID) => deleteSession(sessionID)));
    }

    export function getSession (id: AdMobAccount | string): Session {
        id = id instanceof Object ? id.id : id;
        if (SESSIONS.has(id)) {
            return sessionFromPartition(SESSIONS.get(id));
        }
        return null;
    }

    export async function signIn (): Promise<ExtractedAdmobAccount> {
        let {id, session} = createAdmobSession();
        let window = await openAdMobSignInWindow(session),
            addedAccount: ExtractedAdmobAccount;
        await session.clearCache();
        waitForSignIn(window)
            .then(() => getAdmobAccountBySession(session))
            .then((account) => {
                if (account) {
                    if (SESSIONS.has(account.id)) {
                        deleteSession(SESSIONS.get(account.id));
                    }
                    SESSIONS.set(account.id, id);
                    saveSessions();
                }
                addedAccount = account;
                window.close();
                return SyncHistory.setAuthorizationRequired(account, false);
            });
        return new Promise(resolve => {
            window.once('close', () => {
                let sessionIds = [...SESSIONS.values()];
                if (!sessionIds.includes(id)) {
                    deleteSession(id);
                }
                resolve(addedAccount || null);
            });
        });
    }

    async function deleteSession (sessionId: string): Promise<void> {
        try {

            let accountId: string;
            SESSIONS.forEach((v, k) => {
                if (sessionId === k) {
                    accountId = v;
                }
            });
            if (accountId) {
                SESSIONS.delete(accountId);
                await saveSessions();
            }

            const session = sessionFromPartition(sessionId);

            await removeSession(session, sessionId);
        } catch (e) {
            console.error(e);
        }
    }

    function saveSessions (): Promise<void> {
        return saveJsonFile(sessionsFileName, [...SESSIONS.entries()].reduce((acc, [accId, sessionId]) => {
            acc[accId] = sessionId;
            return acc;
        }, {}));
    }

    function createAdmobSession (): { id: string, session: Session } {
        let id = `admob_${uuid()}`;
        return {
            id,
            session: sessionFromPartition(id)
        };
    }

    /**
     * TODO: use for developers mode only!
     * it lack of integrity check!
     */
    export function openAdmob (account: Pick<AdMobAccount, 'id'>) {
        let session = getSession(account.id);
        if (!session) {
            let {id, session} = createAdmobSession();
            SESSIONS.set(account.id, id);
            return openAdMobSignInWindow(session);
        }
        return openAdMobSignInWindow(session);
    }

    function openAdMobSignInWindow (session): Promise<BrowserWindow> {
        return openWindow('https://apps.admob.com/v2/home', {
            frame: true,
            show: true,
            titleBarStyle: 'default',
            minHeight: 700,
            height: 700,
            webPreferences: {
                nodeIntegration: false,
                session
            }
        });
    }

    async function waitForSignIn (window: BrowserWindow): Promise<BrowserWindow> {
        await waitForNavigation(window, /^https:\/\/apps\.admob\.com\/v2/);
        return window;
    }


    function getAdmobAccountBySession (session): Promise<ExtractedAdmobAccount> {
        return retry(
            () => nodeFetch('https://apps.admob.com/v2/home', {}, session)
                .then(r => r.text())
                .then(responseText => extractAccountInfo(responseText))
            , 2)
            .catch(e => {
                console.error(e);
                return null;
            });
    }


    export async function reSignIn (currentAccount: AdMobAccount): Promise<ExtractedAdmobAccount> {
        let session = await getSession(currentAccount);
        let tempSession: { id: string, session: Session };
        if (!session) {
            tempSession = createAdmobSession();
            SESSIONS.set(currentAccount.id, tempSession.id);
            session = tempSession.session;
        }
        let resultAccount: ExtractedAdmobAccount = await getAdmobAccountBySession(session);

        if (resultAccount) {
            await afterSuccessfulSignInAdmob(currentAccount, resultAccount);
            return resultAccount;
        }

        let window = await openAdMobSignInWindow(session);

        waitForSignIn(window)
            .then(() => getAdmobAccountBySession(session))
            .then((account) => {
                if (!account) {
                    Sentry.withScope(scope => {
                        scope.setExtra('admobAccount', currentAccount);
                        Sentry.captureMessage('Account not found after re-sign in admob', Severity.Error);
                    });
                }
                resultAccount = account;
                window.close();
            });

        return new Promise(resolve => {
            window.once('close', async () => {
                resolve(await afterSuccessfulSignInAdmob(currentAccount, resultAccount));
            });
        });
    }

    async function attachSession (accountID: string, oldAccountId) {
        const sessionId = SESSIONS.get(oldAccountId);
        SESSIONS.delete(oldAccountId);
        SESSIONS.set(accountID, sessionId);
        await saveSessions();
        await SyncHistory.setAuthorizationRequired({id: accountID}, false);
    }

    async function afterSuccessfulSignInAdmob (currentAccount: AdMobAccount, resultAccount: ExtractedAdmobAccount) {
        if (!resultAccount) {
            await deleteSession(SESSIONS.get(currentAccount.id));
            await SyncHistory.setAuthorizationRequired(currentAccount, true);
            return null;
        }

        if (resultAccount.id === currentAccount.id) {
            await attachSession(currentAccount.id, currentAccount.id);
            return resultAccount;
        }

        await attachSession(resultAccount.id, currentAccount.id);

        return resultAccount;
    }


    export function openSetupTutorial () {
        return shell.openExternal(environment.setupOptions.tutorialUrl);
    }

}
