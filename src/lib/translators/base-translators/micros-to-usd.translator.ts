import {ITranslator} from './translator.interface';


/**
 *  specific Currency amount format
 *  1$    = "1000000"
 *  0.01$ = "10000"
 */
export class MicrosToUSDTranslator implements ITranslator {

    private multiplier = 1000000;

    decode (v: string): number {
        return parseFloat(v) / this.multiplier;
    }

    encode (floatNumber: number): any {
        return (this.multiplier * floatNumber).toFixed(0);
    }

}
