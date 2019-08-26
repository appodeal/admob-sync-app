import {cutElectronFromUserAgent} from './user-agent';


describe('should convert chrome to firefox for mac', () => {
    it('with patch version', () => {
        const to = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:68.0) Gecko/20100101 Firefox/68.0',
            from = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) AdMobSync/0.1.28 Chrome/73.0.3683.121 Electron/5.0.1 Safari/537.36';
        expect(cutElectronFromUserAgent(from)).toBe(to);
    });

    it('with no version', () => {
        const to = 'Mozilla/5.0 (Macintosh; Intel Mac OS X; rv:68.0) Gecko/20100101 Firefox/68.0',
            from = 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) AdMobSync/0.1.28 Chrome/73.0.3683.121 Electron/5.0.1 Safari/537.36';
        expect(cutElectronFromUserAgent(from)).toBe(to);
    });

    it('with minor version', () => {
        const to = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:68.0) Gecko/20100101 Firefox/68.0',
            from = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/537.36 (KHTML, like Gecko) AdMobSync/0.1.28 Chrome/73.0.3683.121 Electron/5.0.1 Safari/537.36';
        expect(cutElectronFromUserAgent(from)).toBe(to);
    });

    it('with major version', () => {
        const to = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10; rv:68.0) Gecko/20100101 Firefox/68.0',
            from = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10) AppleWebKit/537.36 (KHTML, like Gecko) AdMobSync/0.1.28 Chrome/73.0.3683.121 Electron/5.0.1 Safari/537.36';
        expect(cutElectronFromUserAgent(from)).toBe(to);
    });
});


describe('should convert chrome to firefox for win32', () => {
    it('', () => {
        const to = 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:68.0) Gecko/20100101 Firefox/68.0',
            from = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36';
        expect(cutElectronFromUserAgent(from)).toBe(to);
    });
});
