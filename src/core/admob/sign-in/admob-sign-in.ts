import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {session} from 'electron';
import {AdmobAccount} from 'interfaces/appodeal.interfaces';
import {createScript, openWindow} from 'lib/common';
import {deleteSession, getJsonFile, saveJsonFile} from 'lib/json-storage';
import uuid from 'uuid';


export namespace AdmobSignInService {

    let sessions: Map<string, string>;
    const loadSessions = async () => {
        if (sessions) {
            return sessions;
        }
        sessions = await getJsonFile('admob-sessions').then(sessions => sessions
            ? new Map(Object.entries(sessions))
            : new Map()
        );
        return sessions;
    };

    export async function getSession (account: AdMobAccount) {
        const sessions = await loadSessions();
        let sessionId = sessions.get(account.id);
        return session.fromPartition(`persist:${sessionId}`);
    }

    async function saveSessions (sessions: Map<string, string>) {
        return saveJsonFile('admob-sessions', [...sessions.entries()].reduce((acc, [accId, sessionId]) => {
            acc[accId] = sessionId;
            return acc;
        }, {}));
    }


    export async function signIn (): Promise<AdmobAccount> {
        let url = 'https://apps.admob.com/v2/home',
            sessionId = uuid.v4(),
            windowSession = session.fromPartition(`persist:${sessionId}`),
            win = await openWindow(url, {
                frame: true,
                titleBarStyle: 'default',
                minHeight: 700,
                height: 700,
                webPreferences: {
                    session: windowSession
                }
            });
        await new Promise(resolve => {
            win.webContents.on('did-navigate', (_, address) => {
                if (new RegExp('^https://apps.admob.com/v2/home').test(address)) {
                    win.webContents.removeAllListeners('did-navigate');
                    resolve();
                }
            });
        });
        let account = await win.webContents.executeJavaScript(createScript(() => {
            let getXsrf = () => {
                    return window['$acx'].xsrfToken;
                },
                getId = () => {
                    return /pub-\d+/.exec(document.documentElement.innerHTML)[0];
                },
                getEmail = () => {
                    try {
                        let parsedAmrpd = JSON.parse(window['amrpd']),
                            userInfo = parsedAmrpd[32][3];
                        return userInfo[1];
                    } catch (e) {
                        return '';
                    }
                };
            return {
                id: getId(),
                email: getEmail(),
                xsrfToken: getXsrf()
            };
        })) as AdmobAccount;
        win.close();
        if (sessions.has(account.id)) {
            await deleteSession(sessions.get(account.id));
        }
        sessions.set(account.id, sessionId);
        await saveSessions(sessions);
        return account;
    }

    export async function openAdmobWindow (account: AdmobAccount) {
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
}
