import {RawTranslator} from './raw.translator';
import {Translator} from './translator.type';


/**
 * number - AdMob protobuff's property
 * string - human readable property name
 * RawTranslator - class to convert properties value from admobs format & vice versa
 */
export type PropertyMap = Record<number, [string, Translator]>;

export type ReversePropertyMap = Record<string, [number, Translator]>;

export const normalizeMap = (map: Record<number, any | [any, Translator]>): PropertyMap => Object.entries(map)
    .reduce((acc, [key, value]) => {
        acc[key] = Array.isArray(value)
            ? value
            : [value, RawTranslator];
        return acc;
    }, {});

export const invertMap = (map: PropertyMap): ReversePropertyMap => Object.entries(map).reduce((acc, [numKey, value]) => {
    // acc[]
    const strKey = value[0],
        translator = value[1];
    acc[strKey] = [numKey, translator];
    return acc;
}, {});

const translators = new Map<any, any>();

export function getTranslator<T extends RawTranslator> (translatorClass: Translator): T {
    if (!translators.has(translatorClass)) {
        translators.set(translatorClass, new translatorClass());
    }
    return translators.get(translatorClass);

}