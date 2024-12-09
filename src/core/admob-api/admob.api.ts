import {InternalError} from 'core/error-factory/errors/internal-error';
import {AdmobErrorTranslator} from 'lib/translators/admop-error.translator';
import {getTranslator} from 'lib/translators/translator.helpers';
import trim from 'lodash.trim';
import {decodeOctString} from '../../lib/oct-decode';


export class RefreshXsrfTokenError extends Error {}


export interface UpdateRequest {
    1: any; // encoded App|AdUnit
    2: { 1: string[] }; // updateMask
}

export interface UpdateResponse {
    1: any; // encoded App|AdUnit
    2: any; // validation Status
}

export class AdmobApiService {

    private host = trim(environment.services.ad_mob, '/');
    private xsrfToken: string;
    private camApiXsrfToken: string;

    public onError: (e: InternalError) => void;

    // updated api version
    isCamApi(serviceName: string, method: string) {
        return serviceName === 'AppService' && method === 'Create' || serviceName === 'AppService' && method === 'Update' || serviceName === 'AppService' && method === 'Search' || serviceName === 'AppService' && method === 'List';
    }

    private getPostApiEndpoint(serviceName: string, method: string) {
        return [
            serviceName === 'AppService' ? 'https://admob.google.com' : this.host,
            this.isCamApi(serviceName, method) ? 'cam' : 'inventory',
            '_/rpc',
            serviceName,
            method,
        ].join('/');
    }

    constructor(private fetcher = fetch, private logger: Partial<Console>) {
    }


    private setXrfToken(xsrfToken) {
        this.xsrfToken = xsrfToken;
    }

    public setCamApiXsrfToken(xsrfToken) {
        this.camApiXsrfToken = xsrfToken;
    }

    private async fetch<T>(url: string, contentType: string, body: string, useCamXsrf = false): Promise<T> {
        return this.fetcher(
            url,
            {
                'credentials': 'include',
                'headers': {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': contentType,
                    'x-framework-xsrf-token': useCamXsrf ? this.camApiXsrfToken : this.xsrfToken,
                },
                'referrerPolicy': 'no-referrer-when-downgrade',
                'body': body,
                'method': 'POST',
                'mode': 'cors',
            },
        )
            .then(async r => {
                try {
                    return await r.json();
                } catch (e) {
                    this.logger.info(await r.text());
                    throw e;
                }
            });
    }

    refreshXsrfToken(body: string) {
        const mathResult = body.match(/xsrfToken: '([^\']*)'/);
        if (!mathResult || !mathResult[1]) {
            // may be user's action required
            throw new RefreshXsrfTokenError('failed to refresh xsrfToken');
        }
        this.setXrfToken(mathResult[1]);

    }

    ejectCamApiXsrfToken(body: string): string {

        const mathResult = body.match(/var camClientInfo = '(?<camClientInfoJson>[^\']*)';/);

        if (!mathResult || !mathResult.groups || !mathResult.groups.camClientInfoJson) {
            // may be user's action required
            throw new RefreshXsrfTokenError('camClientInfoJson not found');
        }
        let json;
        try {
            json = decodeOctString(mathResult.groups.camClientInfoJson);
            const camClientInfo = <any[]>JSON.parse(json);
            return camClientInfo['1'];
        } catch (e) {
            console.log('camClientInfo', json, body);
            console.error(e);
            throw e;
        }
    }

    fetchHomePage(): Promise<Response> {
        return this.fetcher(
            'https://admob.google.com/v2/home',
            {
                'credentials': 'include',
                'headers': {
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.9',
                    'upgrade-insecure-requests': '1',
                },
                'referrerPolicy': 'no-referrer-when-downgrade',
                'body': null,
                'method': 'GET',
                'mode': 'cors',
            },
        );
    }

    fetchCamApiAppsSettings(admobAccountId: string): Promise<Response> {
        return this.fetcher(
            `https://admob.google.com/cam/App?authuser=0&host=ADMOB&pubc=${admobAccountId}`,
            {
                'credentials': 'include',
                'headers': {'accept': '*/*', 'accept-language': 'en-US'},
                'referrer': 'https://admob.google.com/v2/apps/list',
                'referrerPolicy': 'no-referrer-when-downgrade',
                'body': null,
                'method': 'POST',
                'mode': 'cors',
            },
        );
    }

    async getApps(): Promise<string> {
        return this.fetch(
            'https://admob.google.com/v2/inventory/_/rpc/InventoryEntityCollectionService/GetAppSnippets?authuser=0&authuser=0',
            'application/x-www-form-urlencoded',
            'f.req={}',
            false,
        );
    }

    private handleError(e: InternalError) {
        if (e && this.onError) {
            return this.onError(e);
        }
    }

    /**
     * to Post single entity action
     * it comes as "1" property of payload and the same prop in response
     * @param serviceName
     * @param method
     * @param payload
     */
    post(serviceName: string, method: string, payload: any) {
        return this.postRaw(serviceName, method, payload).then((data) => data[1]);
    }

    /**
     * post requests to Admob
     * @param serviceName
     * @param method
     * @param payload
     */
    postRaw(serviceName: string, method: string, payload: any) {
        return this.fetch(
            this.getPostApiEndpoint(serviceName, method),
            'application/x-www-form-urlencoded',
            `${this.isCamApi(serviceName, method) ? 'f.req' : '__ar'}=${encodeURIComponent(JSON.stringify(payload))}`,
            this.isCamApi(serviceName, method),
        )
            .then((data) => {
                if (this.isCamApi(serviceName, method)) {
                    return data;
                }
                if (data[1] !== undefined) {
                    return data;
                }
                if (data[2]) {
                    throw getTranslator(AdmobErrorTranslator).decode(data);
                }

                if ((method === 'List' || method === 'ListGoogleBiddingAdUnits') && Object.keys(data).length === 0) {
                    return {1: []};
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
