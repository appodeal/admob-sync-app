import {InternalError} from 'core/error-factory/errors/internal-error';
import {AppTranslator} from 'lib/translators/admob-app.translator';
import {AdUnitTranslator} from 'lib/translators/admop-ad-unit.translator';
import {AdmobErrorTranslator} from 'lib/translators/admop-error.translator';
import {AdMobAdUnit} from 'lib/translators/interfaces/admob-ad-unit.interface';
import {AdMobApp} from 'lib/translators/interfaces/admob-app.interface';
import {getTranslator} from 'lib/translators/translator.helpers';
import trim from 'lodash.trim';


export class AdmobApiService {

    private host = trim(environment.services.ad_mob, '/');
    private xsrfToken: string;

    public onError: (e: InternalError) => void;

    private get appsEndpointUrl () {
        return this.host + '/tlcgwt/inventory';
    }

    private getPostApiEndpoint (serviceName: string, method: string) {
        return [this.host, 'inventory/_/rpc', serviceName, method].join('/');
    }

    constructor (private fetcher = fetch, private logger: Partial<Console>) {
    }


    setXrfToken (xsrfToken) {
        this.xsrfToken = xsrfToken;
    }

    private async fetch<T> (url: string, contentType: string, body: string): Promise<T> {
        return this.fetcher(
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

    async refreshXsrfToken () {
        const response = await this.fetchHomePage();
        const body = await response.text();
        const mathResult = body.match(/xsrfToken: '([^\']*)'/);
        if (!mathResult || !mathResult[1]) {
            // may be user's action required
            throw new Error('failed to refresh xsrfToken');
        }
        this.setXrfToken(mathResult[1]);
    }

    fetchHomePage (): Promise<Response> {
        return this.fetcher(
            'https://apps.admob.com/v2/home',
            {
                'credentials': 'include',
                'headers': {
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.9',
                    'upgrade-insecure-requests': '1'
                },
                'referrerPolicy': 'no-referrer-when-downgrade',
                'body': null,
                'method': 'GET',
                'mode': 'cors'
            }
        );
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
            error?: any
        }>
        (
            this.appsEndpointUrl,
            'application/json;charset=UTF-8',
            `{method: "initialize", params: {}, xsrf: "${this.xsrfToken}"}`
        )
            .then(responseBody => {
                if (responseBody.error) {
                    throw  new Error(JSON.stringify(responseBody));
                }
                const apps = responseBody.result[1][1] || [];
                const adUnits = responseBody.result[1][2] || [];
                return {
                    apps: apps.map<AdMobApp>(getTranslator(AppTranslator).decode),
                    adUnits: adUnits.map<AdMobAdUnit>(getTranslator(AdUnitTranslator).decode)
                };
            })
            .catch(e => {
                this.handleError(e);
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
        )
            .then((data) => {
                if (data[1] !== undefined) {
                    return data;
                }
                if (data[2]) {
                    throw getTranslator(AdmobErrorTranslator).decode(data);
                }
                throw new InternalError('Unknow Admob Response', data);

            })
            .catch(e => {
                this.logger.error(`Failed to Post to AdMob '${serviceName}' '${method}'`);
                this.logger.info(`payload`, payload);
                this.logger.error(e);
                this.handleError(e);
                throw e;
            });
    }


}
