import {JsonStorage} from './json-storage.interface';


export class InmemoryJsonStorage implements JsonStorage {
    private memory = new Map<string, any>();

    async save (key: string, value: any): Promise<void> {
        this.memory.set(key, value);
    }

    async load (key: string, defaultValue?: any): Promise<any> {
        if (this.memory.has(key)) {
            return this.memory.get(key);
        }
        return defaultValue;
    }

}
