import {
    closeAdMobSignInWindow,
    createAdmobSession,
    extractAccountInfo,
    openAdMobSignInWindow,
    waitForSignIn
} from 'core/admob-api/admob-signin.helper';
import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {InternalError} from 'core/error-factory/errors/internal-error';
import {session, Session} from 'electron';
import {AdMobAdUnit, AdMobApp} from 'interfaces/admob.interfaces';
import {AdmobAccount} from 'interfaces/appodeal.interfaces';
import {AppTranslator} from 'lib/admob-app.translator';
import {AdUnitTranslator} from 'lib/admop-ad-unit.translator';
import {deleteSession, getJsonFile, saveJsonFile} from 'lib/json-storage';
import {getTranslator} from 'lib/translators/translator.helpers';
import trim from 'lodash.trim';


export class AdmobApiService {
    private sessions: Map<string, string>;

    private host = trim(environment.services.ad_mob, '/');
    private xsrfToken: string;

    public onError: (e: InternalError) => void;

    private get appsEndpointUrl () {
        return this.host + '/tlcgwt/inventory';
    }

    private getPostApiEndpoint (serviceName: string, method: string) {
        return [this.host, 'inventory/_/rpc', serviceName, method].join('/');
    }

    constructor (private errorFactory: ErrorFactoryService) {
        getJsonFile('admob-sessions').then(sessions => {
            this.sessions = sessions ? new Map(Object.entries(sessions)) : new Map();
        });
    }

    private getSession (account: AdmobAccount): Session {
        let sessionId = this.sessions.get(account.id);
        return session.fromPartition(`persist:${sessionId}`);
    }

    private saveSessions (sessions: Map<string, string>) {
        return saveJsonFile('admob-sessions', [...sessions.entries()].reduce((acc, [accId, sessionId]) => {
            acc[accId] = sessionId;
            return acc;
        }, {}));
    }

    setXrfToken (xsrfToken) {
        this.xsrfToken = xsrfToken;
    }

    private async fetch<T> (url: string, contentType: string, body: string): Promise<T> {
        return fetch(
            url,
            {
                'credentials': 'include',
                'headers': {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': contentType,
                    'x-framework-xsrf-token': this.xsrfToken
                },
                'referrerPolicy': 'no-referrer-when-downgrade',
                'body': body,
                'method': 'POST',
                'mode': 'cors'
            }
        )
            .then(r => r.json());
    }

    private handleError (e: InternalError) {
        if (e && this.onError) {
            return this.onError(e);
        }
    }

    /**
     * fetch Apps W
     */
    fetchAppsWitAdUnits (): Promise<{
        apps: AdMobApp[],
        adUnits: AdMobAdUnit[]
    }> {
        return this.fetch <{
            result: {
                1: {
                    // encoded Admob Apps
                    1: AdMobApp[]
                    // encoded Admob adUnits Apps
                    2: AdMobAdUnit[]
                }
            }
        }>
        (
            this.appsEndpointUrl,
            'application/json;charset=UTF-8',
            `{method: "initialize", params: {}, xsrf: "${this.xsrfToken}"}`
        )
            .then(responseBody => {
                const apps = responseBody.result[1][1];
                const adUnits = responseBody.result[1][2];
                return {
                    apps: apps.map(getTranslator(AppTranslator).decode),
                    adUnits: adUnits.map(getTranslator(AdUnitTranslator).decode)
                };
            })
            .catch(e => {
                const error = this.errorFactory.create(e);
                this.handleError(error);
                throw e;
            });
    }

    /**
     * to Post single entity action
     * it comes as "1" property of payload and the same prop in response
     * @param serviceName
     * @param method
     * @param payload
     */
    post (serviceName: string, method: string, payload: any) {
        return this.postRaw(serviceName, method, {'1': payload}).then((data) => data[1]);
    }

    /**
     * post requests to Admob
     * @param serviceName
     * @param method
     * @param payload
     */
    postRaw (serviceName: string, method: string, payload: any) {
        return this.fetch(
            this.getPostApiEndpoint(serviceName, method),
            'application/x-www-form-urlencoded',
            `__ar=${encodeURIComponent(JSON.stringify(payload))}`
        ).catch(e => {
            console.error(`Failed to Post to AdMob '${serviceName}' '${method}'`);
            console.log(payload);
            console.error(e);

            const error = this.errorFactory.create(e);
            this.handleError(error);
            throw e;
        });
    }

    async signIn (): Promise<AdmobAccount> {
        let {id, session} = createAdmobSession();
        let window = await openAdMobSignInWindow(session),
            addedAccount: AdmobAccount;
        waitForSignIn(window)
            .then(window => extractAccountInfo(window))
            .then(({account, window}) => {
                if (account) {
                    if (this.sessions.has(account.id)) {
                        deleteSession(this.sessions.get(account.id));
                    }
                    this.sessions.set(account.id, id);
                    this.saveSessions(this.sessions);
                }
                addedAccount = account;
                window.close();
            });
        return new Promise(resolve => {
            window.once('close', () => {
                let sessionIds = [...this.sessions.values()];
                if (!sessionIds.includes(id)) {
                    deleteSession(id);
                }
                resolve(addedAccount || null);
            });
        });
    }

    async removeAccount (accountId: string) {
        let sessionId = this.sessions.get(accountId);
        if (sessionId) {
            this.sessions.delete(accountId);
            await Promise.all([
                deleteSession(sessionId),
                this.saveSessions(this.sessions)
            ]);
        }
    }

}
