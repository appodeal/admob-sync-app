import {ITranslator} from './translator.interface';


export class RawTranslator implements ITranslator {

    decode<T> (v: T): T {
        return v;
    }

    encode<T> (v: T): T {
        return v;
    }
}
