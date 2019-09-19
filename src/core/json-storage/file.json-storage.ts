import {getJsonFile, saveJsonFile} from '../../lib/json-storage';
import {JsonStorage} from './json-storage.interface';


export class FileJsonStorage implements JsonStorage {

    async save (key: string, value: any): Promise<void> {
        return saveJsonFile(key, value);
    }

    async load (key: string, defaultValue: any): Promise<any> {
        return getJsonFile(key, defaultValue);
    }

}
