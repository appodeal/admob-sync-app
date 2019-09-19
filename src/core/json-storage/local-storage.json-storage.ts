import {JsonStorage} from './json-storage.interface';


export class LocalStorageJsonStorage implements JsonStorage {

    async save (key: string, value: any): Promise<void> {
        localStorage.setItem(key, JSON.stringify(value));
    }

    async load (key: string, defaultValue?: any): Promise<any> {
        try {
            const result = JSON.parse(localStorage.getItem(key));
            if (result) {
                return result;
            }
        } catch (e) {
            console.warn(`[LocalStorageJsonStorage] failed to parse json`, e);
        }
        return defaultValue;
    }

}
