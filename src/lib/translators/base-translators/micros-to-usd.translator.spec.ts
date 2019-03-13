import {MicrosToUSDTranslator} from './micros-to-usd.translator';


describe('MicrosTranslator', () => {
    it('should decode', () => {
        const translator = new MicrosToUSDTranslator();
        expect(translator.decode('1000000')).toEqual(1);
        expect(translator.decode('10000')).toEqual(0.01);
    });

    it('should decode', () => {
        const translator = new MicrosToUSDTranslator();
        expect(translator.encode(1)).toEqual('1000000');
        expect(translator.encode(0.01)).toEqual('10000');
    });
});
