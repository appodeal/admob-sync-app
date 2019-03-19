import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {app, BrowserWindow, Session, session, shell} from 'electron';
import * as fs from 'fs-extra';
import {createScript, openWindow, waitForNavigation} from 'lib/common';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import path from 'path';
import uuid from 'uuid';


export namespace AdMobSessions {

    let SESSIONS: Map<string, string>;

    getJsonFile('admob-sessions').then(sessions => {
        SESSIONS = sessions ? new Map(Object.entries(sessions)) : new Map();
    });

    export function getSession (id: AdMobAccount | string): Session {
        id = id instanceof Object ? id.id : id;
        if (SESSIONS.has(id)) {
            return session.fromPartition(`persist:${SESSIONS.get(id)}`);
        }
        return null;
    }

    export async function signIn (): Promise<AdMobAccount> {
        let {id, session} = createAdmobSession();
        let window = await openAdMobSignInWindow(session),
            addedAccount: AdMobAccount;
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

    export async function removeSession ({id}: AdMobAccount): Promise<void> {
        let sessionId = SESSIONS.get(id);
        if (sessionId) {
            SESSIONS.delete(id);
            await Promise.all([
                deleteSession(sessionId),
                saveSessions()
            ]);
        }
    }

    function deleteSession (sessionId: string): Promise<void> {
        return fs.remove(path.resolve(app.getPath('userData'), `./Partitions/${sessionId}`));
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
            session: session.fromPartition(`persist:${id}`)
        };
    }

    function openAdMobSignInWindow (session): Promise<BrowserWindow> {
        return openWindow('https://apps.admob.com/v2/home', {
            frame: true,
            titleBarStyle: 'default',
            minHeight: 700,
            height: 700,
            webPreferences: {
                session
            }
        });
    }

    async function waitForSignIn (window: BrowserWindow): Promise<BrowserWindow> {
        await waitForNavigation(window, 'https://apps.admob.com/v2/home');
        return window;
    }

    function extractAccountInfo (window: BrowserWindow): Promise<{ window: BrowserWindow, account: AdMobAccount }> {
        return window.webContents.executeJavaScript(createScript(() => {
            let xsrfToken = window['$acx'].xsrfToken,
                id = /pub-\d+/.exec(document.documentElement.innerHTML)[0],
                email = (() => {
                    try {
                        let parsedAmrpd = JSON.parse(window['amrpd']),
                            userInfo = parsedAmrpd[32][3];
                        return userInfo[1];
                    } catch (e) {
                        return '';
                    }
                })();
            if (xsrfToken && id && email) {
                return {
                    id,
                    email,
                    xsrfToken
                };
            }
            return null;
        }))
            .then(account => ({
                account,
                window
            }));
    }

    export async function openAdmobWindow (account: AdMobAccount) {
        const windowSession = await getSession(account);
        let url = 'https://apps.admob.com/v2/home';
        return openWindow(url, {
            frame: true,
            titleBarStyle: 'default',
            minHeight: 700,
            height: 700,
            webPreferences: {
                session: windowSession
            }
        });
    }


    export function openSetupTutorial () {
        return shell.openExternal('https://wiki.appodeal.com');
    }

}
