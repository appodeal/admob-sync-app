import {app, Session} from 'electron';
import fs from 'fs-extra';
import path from 'path';


export function deepAssign<T> (target: Partial<T>, ...sources: Array<Partial<T>>): T {
    for (let source of sources) {
        for (let [key, value] of objectIterator(source)) {
            if (isObject(value)) {
                target[key] = deepAssign(target[key] || {}, value);
            } else {
                target[key] = value;
            }
        }
    }
    return target as T;
}

export function deepFreeze<T> (obj: T): T {
    for (let [key, value] of objectIterator(obj)) {
        if (isObject(value)) {
            obj[key] = deepFreeze(value);
        }
    }
    return Object.freeze(obj);
}

export async function removeSession (session: Session, sessionId: string) {
    if (typeof session['destroy'] === 'function') {
        await session['destroy']();
    }
    session.removeAllListeners();
    await fs.remove(path.resolve(app.getPath('userData'), `./Partitions/${sessionId}`))
        .catch(err => console.error(err));
}

class ObjectIterator<T = any> {
    constructor (private obj: T) {}

    * keys (): IterableIterator<keyof T> {
        for (let key of Object.keys(this.obj)) {
            yield key as keyof T;
        }
    }

    * values (): IterableIterator<T[keyof T]> {
        for (let value of Object.values(this.obj)) {
            yield value as T[keyof T];
        }
    }

    * entries (): IterableIterator<[keyof T, T[keyof T]]> {
        for (let entry of Object.entries(this.obj)) {
            yield entry as [keyof T, T[keyof T]];
        }
    }

    [Symbol.iterator] (): IterableIterator<[keyof T, T[keyof T]]> {
        return this.entries();
    }
}

export function objectIterator<T> (obj: T): ObjectIterator<T> {
    return new ObjectIterator<T>(obj);
}

export function isObject (obj: any) {
    return obj && typeof obj === 'object' && obj.constructor === Object;
}

export function getMapItem<K, V> (map: Map<K, V>, index: number): V {
    if (index < 0 || index > map.size || !Number.isInteger(index)) {
        return undefined;
    }
    let i = 0;
    for (let value of map.values()) {
        if (i === index) {
            return value;
        }
        i++
    }
    return undefined;
}
