export enum SyncEventsTypes {
    Started,
    CalculatingProgress,
    ReportProgress,
    UserActionsRequired,
    Error,
    Stopped
}

export interface SyncErrorEvent extends SyncEvent {
    type: SyncEventsTypes.Error
    id: string
    error: Error;
}

export interface SyncReportProgressEvent extends SyncEvent {
    type: SyncEventsTypes.ReportProgress;
    total: number;
    synced: number;
    failed?: number
}

export interface SyncEvent {
    type: SyncEventsTypes
    id: string
}
