export interface JsonStorage {

    save (key: string, value: any): Promise<void>
    load (key: string, defaultValue?: any): Promise<any>

}
