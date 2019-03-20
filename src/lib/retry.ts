export async function retry (cb: CallableFunction, maxAttempts = 3) {
    let attempt = 0,
        lastError;
    while (attempt < maxAttempts) {
        attempt++;
        try {
            return await cb();
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError;
}
