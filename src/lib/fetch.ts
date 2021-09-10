import {Cookie, net, Session} from 'electron';


export interface Fetcher extends Function {
    (input: RequestInfo, init?: RequestInit): Promise<Response>;
}

interface FetchOptions {
    method: string;
    body: string;
    headers: { [key: string]: string }
}

const DEFAULT_FETCH_CONFIG: FetchOptions = {
    method: 'GET',
    body: null,
    headers: null
};


export function createFetcher (session: Session): Fetcher {
    return (url: string, init?: FetchOptions): Promise<any> => {
        return nodeFetch(url, init, session);
    };
}


export function nodeFetch<T extends any> (
    url: string,
    options: Partial<FetchOptions> = {},
    session?: Session
): Promise<{ ok: boolean, status: number, statusText: string, headers: Record<string, string | string[]>, text: () => Promise<string>, json: () => Promise<T> }> {
    return new Promise(async (resolve, reject) => {
        let config = {
            ...DEFAULT_FETCH_CONFIG,
            ...options
        };
        let request = net.request({
            url,
            method: config.method,
            session
        });

        if (session) {
            let cookies = await getSessionCookies(session);
            request.setHeader('Cookie', cookies.map(({name, value}) => `${name}=${value}`).join('; '));
        }

        if (config.headers instanceof Object) {
            for (let [header, value] of Object.entries(config.headers)) {
                request.setHeader(header, value);
            }
        }

        request.on('login', () => {
            reject(new Error('Unauthorized'));
        });
        request.once('error', error => {
            request.removeAllListeners();
            reject(error);
        });
        request.once('response', response => {
            request.removeAllListeners();
            let chunks = [];
            response.on('data', datum => chunks.push(datum));
            response.once('end', () => {
                response.removeAllListeners();
                let data = Buffer.concat(chunks).toString();
                resolve({
                    ok: response.statusCode === 200,
                    headers: response.headers,
                    status: response.statusCode,
                    statusText: response.statusMessage,
                    text: async () => data,
                    json: async () => JSON.parse(data)
                });
            });
            response.once('error', error => {
                response.removeAllListeners();
                reject(error);
            });
        });

        if (config.body !== undefined && config.body !== null) {
            request.write(config.body.toString());
        }
        request.end();
    });
}

export function getSessionCookies (session: Session): Promise<Array<Cookie>> {
    return session.cookies.get({}) as unknown as Promise<Array<Cookie>>;
}
