import {ITranslator} from './translator.interface';


export abstract class ArrayTranslator<T> implements ITranslator {

    protected constructor (private t: ITranslator) {
    }

    public decode = (source: any[]): T[] => {
        return source.map(v => this.t.decode(v));
    };

    public encode = (source: Partial<T>[]): T[] => {
        return source.map(v => this.t.encode(v));

    };

}
