export function fetcher (input: RequestInfo, init?: RequestInit) {
    console.log(`[FETCH]`, input, init);
    return globalThis.fetch(input, init).catch(e => {
        console.error(`[FETCH]`, input, init, e);
        throw e;
    });
}
