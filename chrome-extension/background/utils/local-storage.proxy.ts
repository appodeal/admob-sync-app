import {deepClone} from '../../../src/lib/core';


function loadStoredValues (key, value, exclude: string[]) {
    try {
        const rawValue = localStorage.getItem(key);
        if (rawValue === null) {
            return;
        }
        const storedValues = JSON.parse(rawValue);
        Object.keys(value).filter(key => !exclude.includes(key)).forEach(key => value[key] = storedValues[key]);
    } catch (e) {
        console.warn(e);
    }
}

function storeValues (key, values) {
    try {
        localStorage.setItem(key, JSON.stringify(values));
    } catch (e) {
        console.warn(e);
    }

}

export function localStorageProxy<T extends Object> (storageKey, value, exclude: string[]): T {
    console.debug('[localStorageProxy] start ', deepClone(value));

    loadStoredValues(storageKey, value, exclude);
    console.debug('[localStorageProxy] stored values loaded ', deepClone(value));

    const original = deepClone(value);
    let timeoutID;
    const save = () => storeValues(storageKey, original);
    const getter = key => () => original[key];
    const setter = key => value => {
        original[key] = value;
        clearTimeout(timeoutID);
        setTimeout(save);
    };
    Object.keys(value).filter(key => !exclude.includes(key)).map(key =>
        Object.defineProperty(value, key, {
            get: getter(key),
            set: setter(key)
        })
    );
    console.debug('[localStorageProxy] getters & setters updated', deepClone(value));
    return value;
}
