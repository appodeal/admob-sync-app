import {sleep} from 'lib/time';


export async function retry (cb: CallableFunction, maxAttempts = 3, sleepBetweenMs?: number) {
    return retryOn(cb, () => true, maxAttempts, sleepBetweenMs);
}

export async function retryOn (cb: CallableFunction, condition: (e: Error) => boolean, maxAttempts = 3, sleepBetweenMs?: number) {
    let attempt = 0,
        lastError;
    while (attempt < maxAttempts) {
        attempt++;
        try {
            return await cb();
        } catch (e) {
            lastError = e;
            if (!condition(e)) {
                throw lastError;
            }
            if (typeof sleepBetweenMs === 'number') {
                await sleep(sleepBetweenMs);
            }
        }
    }
    throw lastError;
}

export function retryIfPromise (
    cb: CallableFunction,
    retryCondition: (e: Error) => boolean,
    maxAttempts = 3,
    sleepBetweenMs?: number
) {

    const firstAttemptResult = cb();
    if (!(firstAttemptResult instanceof Promise)) {
        return firstAttemptResult;
    }
    return firstAttemptResult.catch(e => {
        if (retryCondition(e)) {
            return retryOn(
                cb,
                retryCondition,
                maxAttempts - 1,
                sleepBetweenMs
            );
        }
        throw e;
    });

}

export function retryProxy<T extends object> (
    target: T,
    retryCondition: (e: Error) => boolean,
    maxAttempts = 3,
    sleepBetweenMs?: number,
    onEmitError?: (e: Error) => any
): T {
    return new Proxy(target, {
        get (target, p) {
            const propValue = target[p];

            if (typeof propValue !== 'function') {
                return propValue;
            }

            return function (...args) {
                return retryIfPromise(
                    () => propValue.apply(target, args),
                    retryCondition,
                    maxAttempts,
                    sleepBetweenMs
                ).catch(e => {
                    onEmitError ? onEmitError(e) : null;
                    throw e;
                });
            };
        }
    });
}
