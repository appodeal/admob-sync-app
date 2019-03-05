import {BrowserWindow, Session, session} from 'electron';
import {AdmobAccount} from 'interfaces/appodeal.interfaces';
import {createScript, openWindow} from 'lib/common';
import {deleteSession} from 'lib/json-storage';
import uuid from 'uuid/v1';


export function createAdmobSession (): { id: string, session: Session } {
    let id = `admob_${uuid()}`,
        windowSession = session.fromPartition(`persist:${id}`);
    return {
        id,
        session: windowSession
    };
}

export function openAdMobSignInWindow (session): Promise<BrowserWindow> {
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

export function closeAdMobSignInWindow (window: BrowserWindow, account: AdmobAccount, checker: () => boolean): Promise<AdmobAccount> {
    return new Promise(resolve => {
        window.once('close', () => {
            resolve(checker() ? account : null);
        });
    });
}

export function waitForSignIn (window: BrowserWindow): Promise<BrowserWindow> {
    return new Promise(resolve => {
        window.webContents.on('did-navigate', (_, address) => {
            if (new RegExp('^https://apps.admob.com/v2/home').test(address)) {
                window.webContents.removeAllListeners('did-navigate');
                window.webContents.once('dom-ready', () => resolve(window));
            }
        });
    });
}

export function extractAccountInfo (window: BrowserWindow): Promise<{ window: BrowserWindow, account: AdmobAccount }> {
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
