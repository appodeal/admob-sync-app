import {Sync} from './sync';


describe('sync', () => {
    it('normalizeAdmobAdUnitName', async () => {
        expect(Sync.normalizeAdmobAdUnitName('random adunit')).toBe('random adunit');

        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/interstitial/image')).toBe('Appodeal/157197/interstitial/image_and_text');

        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/banner/image')).toBe('Appodeal/157197/banner/image_and_text');
        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/interstitial/image')).toBe('Appodeal/157197/interstitial/image_and_text');
        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/mrec/image')).toBe('Appodeal/157197/mrec/image_and_text');



        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/interstitial/image_and_text/')).toBe('Appodeal/157197/interstitial/image_and_text/');
        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/interstitial/image_and_text')).toBe('Appodeal/157197/interstitial/image_and_text');


        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/interstitial/image_and_text/25')).toBe('Appodeal/157197/interstitial/image_and_text/25.00');
        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/interstitial/image_and_text/5')).toBe('Appodeal/157197/interstitial/image_and_text/5.00');
        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/interstitial/image_and_text/1.2')).toBe('Appodeal/157197/interstitial/image_and_text/1.20');
        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/interstitial/image_and_text/1.25')).toBe('Appodeal/157197/interstitial/image_and_text/1.25');


        expect(Sync.normalizeAdmobAdUnitName('Appodeal/157197/interstitial/image_and_text/1.00')).toBe('Appodeal/157197/interstitial/image_and_text/1.00');

    });

});
