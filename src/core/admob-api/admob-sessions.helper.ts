import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {SyncHistory} from 'core/sync-apps/sync-history';
import {app, BrowserWindow, Session, session, shell} from 'electron';
import * as fs from 'fs-extra';
import {ExtractedAdmobAccount} from 'interfaces/common.interfaces';
import {createScript, openWindow, waitForNavigation} from 'lib/common';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import path from 'path';
import uuid from 'uuid';


export namespace AdMobSessions {

    let SESSIONS: Map<string, string>;

    function sessionFromPartition (sessionID: string) {
        return session.fromPartition(`persist:${sessionID}`);
    }

    getJsonFile('admob-sessions').then(sessions => {
        SESSIONS = sessions ? new Map(Object.entries(sessions)) : new Map();
    });

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
        await new Promise(resolve => session.clearCache(resolve));
        waitForSignIn(window)
            .then(window => extractAccountInfo(window))
            .then(({account, window}) => {
                if (account) {
                    if (SESSIONS.has(account.id)) {
                        deleteSession(SESSIONS.get(account.id));
                    }
                    SESSIONS.set(account.id, id);
                    saveSessions();
                }
                addedAccount = account;
                window.close();
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
            await session.flushStorageData();

            await new Promise(resolve => session.clearCache(resolve));
            await new Promise(resolve => session.clearStorageData({}, resolve));
            await new Promise(resolve => session.clearAuthCache({type: 'password'}, resolve));
            await new Promise(resolve => session.clearAuthCache({type: 'clientCertificate'}, resolve));
            await new Promise(resolve => session.clearHostResolverCache(resolve));
            await (<any>session).destroy();

            return fs.remove(path.resolve(app.getPath('userData'), `./Partitions/${sessionId}`));
        } catch (e) {
            console.error(e);
        }
    }

    function saveSessions (): Promise<void> {
        return saveJsonFile('admob-sessions', [...SESSIONS.entries()].reduce((acc, [accId, sessionId]) => {
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

    function openAdMobSignInWindow (session): Promise<BrowserWindow> {
        return openWindow('https://apps.admob.com/v2/home', {
            frame: true,
            show: true,
            titleBarStyle: 'default',
            minHeight: 700,
            height: 700,
            webPreferences: {
                session
            }
        });
    }

    async function waitForSignIn (window: BrowserWindow): Promise<BrowserWindow> {
        await waitForNavigation(window, /^https:\/\/apps\.admob\.com\/v2/);
        return window;
    }

    function extractAccountInfo (window: BrowserWindow): Promise<{ window: BrowserWindow, account: ExtractedAdmobAccount }> {
        return window.webContents.executeJavaScript(createScript(() => {
            let id = /pub-\d+/.exec(document.documentElement.innerHTML)[0],
                email = (() => {
                    try {
                        let parsedAmrpd = JSON.parse(window['amrpd']),
                            userInfo = parsedAmrpd[32][3];
                        return userInfo[1];
                    } catch (e) {
                        return '';
                    }
                })();
            if (id && email) {
                return {
                    id,
                    email
                };
            }
            return null;
        }))
            .then(account => ({
                account,
                window
            }));
    }


    export async function reSignIn (currentAccount: AdMobAccount): Promise<ExtractedAdmobAccount> {
        let session = await getSession(currentAccount);
        let tempSession: { id: string, session: Session };
        if (!session) {
            tempSession = createAdmobSession();
            SESSIONS.set(currentAccount.id, tempSession.id);
            session = tempSession.session;
        }

        let window = await openAdMobSignInWindow(session),
            resultAccount: ExtractedAdmobAccount;


        waitForSignIn(window)
            .then(window => extractAccountInfo(window))
            .then(({account, window}) => {
                resultAccount = account;
                window.close();
            });

        return new Promise(resolve => {
            window.once('close', async () => {
                resolve(await afterCloseAdmob(currentAccount, resultAccount));
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

    async function afterCloseAdmob (currentAccount: AdMobAccount, resultAccount: ExtractedAdmobAccount) {
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
        return shell.openExternal('https://wiki.appodeal.com');
    }

}
