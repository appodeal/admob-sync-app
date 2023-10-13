import {InternalError} from 'core/error-factory/errors/internal-error';
import trim from 'lodash.trim';

export class RefreshXsrfTokenError extends Error {}

export class CustomEventApiService {

    private host = trim(environment.services.ad_mob, '/');
    private xsrfToken: string;

    public onError: (e: InternalError) => void;

    private static serviceName(name: string): string {
        return `${name.charAt(0).toUpperCase() + name.slice(1)}Service`
    }

    private getPostMediationApiEndpoint(mediation: string, method: string) {
        return [this.host, `${mediation}/_/rpc`, CustomEventApiService.serviceName(mediation), method].join('/');
    }

    constructor(private fetcher = fetch, private logger: Partial<Console>) {
    }

    private setXrfToken(xsrfToken) {
        this.xsrfToken = xsrfToken;
    }

    refreshXsrfToken (body: string) {
        const mathResult = body.match(/xsrfToken: '([^\']*)'/);
        if (!mathResult || !mathResult[1]) {
            throw new RefreshXsrfTokenError('failed to refresh xsrfToken');
        }
        this.setXrfToken(mathResult[1]);
    }

    private async fetch<T>(url: string, contentType: string, body: string): Promise<T> {
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
            .then(async r => {
                try {
                    return await r.json();
                } catch (e) {
                    this.logger.info(await r.text());
                    throw e;
                }
            });
    }

    private handleError(e: InternalError) {
        if (e && this.onError) {
            return this.onError(e);
        }
    }

    /**
     * post requests to Admob
     * @param mediation
     * @param method
     * @param payload
     * @param idx
     */
    postRaw(mediation: string, method: string, payload: any, idx: number = 0) {
        return this.fetch(
            this.getPostMediationApiEndpoint(mediation, method),
            'application/x-www-form-urlencoded',
            `f.req=${encodeURIComponent(JSON.stringify(payload))}`
        )
            .then((data) => {
                return data;
            })
            .catch(e => {
                this.logger.error(`Failed to Post to AdMob '${mediation}Service' '${method}'`);
                this.logger.info(`payload`, payload);
                this.logger.error(e);
                this.handleError(e);
                throw e;
            });
    }
}
