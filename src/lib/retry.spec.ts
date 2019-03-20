import {retry} from 'lib/retry';


describe('retry', () => {
    it('should run callback', async () => {
        const cb = () => 42;
        const result = await retry(cb);
        expect(result).toEqual(42);
    });

    it('should run callback with promise', async () => {
        const cb = () => Promise.resolve(42);
        const result = await retry(cb);
        expect(result).toEqual(42);
    });

    it('should run rethrow last error', async () => {
        const cb = () => Promise.reject(42);
        let result;
        try {
            result = await retry(cb);
        } catch (e) {
            result = e;
        }
        expect(result).toEqual(42);
    });
    it('should get success on the second attempt', async () => {
        let attempt = -1;
        const cb = () => {
            attempt++;
            return attempt
                ? Promise.resolve(42)
                : Promise.reject(0);
        };
        const result = await retry(cb);
        expect(result).toEqual(42);
    });
    it('should not get success as attempt reached the limit', async () => {
        let attempt = -1;
        const cb = () => {
            attempt++;
            return attempt > 10
                ? Promise.resolve(42)
                : Promise.reject(0);
        };
        let result;
        try {
            result = await retry(cb, 3);
        } catch (e) {
            result = e;
        }
        expect(result).toEqual(0);
    });
});
