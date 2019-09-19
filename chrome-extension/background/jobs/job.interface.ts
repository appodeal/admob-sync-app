export interface IJob {
    run (): Promise<void | any>
    before: () => Promise<void | any>
    after: () => Promise<void | any>
    canRun: () => Promise<boolean>
}
