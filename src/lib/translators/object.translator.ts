import {getTranslator, invertMap, normalizeMap, PropertyMap, ReversePropertyMap} from './translator.helpers';
import {ITranslator} from './translator.interface';
import {Translator} from './translator.type';


export abstract class ObjectTranslator<T> implements ITranslator {

    private readonly propsMap: PropertyMap;

    private readonly reverseMap: ReversePropertyMap;

    protected constructor (propsMap: Record<number, keyof T | [keyof T, Translator]>) {
        this.propsMap = normalizeMap(propsMap);
        this.reverseMap = invertMap(this.propsMap);
    }

    public decode = (source: Object): T => {
        return Object.entries(source).reduce((acc, [numKey, value]) => {
            if (!this.propsMap[numKey]) {
                console.warn(`Cant find key '${numKey}' for ${this.constructor.name}`);
                acc[numKey] = value;
                return acc;
            }

            const translator = getTranslator(this.propsMap[numKey][1]);
            acc[this.propsMap[numKey][0]] = translator.decode(value);
            return acc;
        }, <T>{});
    };

    public encode = (source: T): Object => {
        return Object.entries(source).reduce((acc, [strKey, value]) => {
            if (!this.reverseMap[strKey]) {
                console.warn(`Cant find key '${strKey}' for ${this.constructor.name}`);
                acc[strKey] = value;
                return acc;
            }
            const translator = getTranslator(this.reverseMap[strKey][1]);
            acc[this.reverseMap[strKey][0]] = translator.encode(value);
            return acc;
        }, {});
    };

}