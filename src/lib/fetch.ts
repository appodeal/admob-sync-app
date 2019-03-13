import {net, Session} from 'electron';


export interface Fetcher extends Function {
    (input: RequestInfo, init?: RequestInit): Promise<Response>;
    updateSession? (session: Session): void;
}


export function createFetcher (session: Session): Fetcher {
    let _session = session,
        fetcher: Fetcher = (url: string, init?: RequestInit): Promise<any> => {
            return new Promise(async (resolve, reject) => {
                _session.cookies.get({}, (error, cookies = []) => {
                    let request = net.request({
                        session: _session,
                        url,
                        method: init.method
                    });
                    request.once('error', err => reject(err));
                    request.once('response', response => {
                        let chunks = [];
                        response
                            .on('data', chunk => chunks.push(chunk))
                            .on('end', () => {
                                response.removeAllListeners();
                                let buffer = Buffer.concat(chunks),
                                    text = buffer.toString();
                                resolve({
                                    json: () => Promise.resolve(JSON.parse(text)),
                                    text: () => Promise.resolve(text)
                                });
                            });
                    });

                    request.setHeader('Cookie', cookies.map(({name, value}) => `${name}=${value}`).join('; '));
                    for (let [header, value] of Object.entries(init.headers)) {
                        request.setHeader(header, value);
                    }

                    request.end(init.body as string);
                });

            });
        };
    fetcher.updateSession = (session: Session) => {
        _session = session;
    };
    return fetcher;
}
