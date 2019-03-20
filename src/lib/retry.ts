import {sleep} from 'lib/time';


export async function retry (cb: CallableFunction, maxAttempts = 3, sleepBetweenMs?: number) {
    let attempt = 0,
        lastError;
    while (attempt < maxAttempts) {
        attempt++;
        try {
            return await cb();
        } catch (e) {
            lastError = e;
            if (typeof sleepBetweenMs === 'number') {
                await sleep(sleepBetweenMs);
            }
        }
    }
    throw lastError;
}
