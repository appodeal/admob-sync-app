import {ITranslator} from './translator.interface';


export class BooleanTranslator implements ITranslator {

    decode (v: any): boolean {
        return !!v;
    }

    encode (v: boolean): number {
        return v ? 1 : 0;
    }

}
