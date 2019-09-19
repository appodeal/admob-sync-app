export enum SyncEventsTypes {
    Started = 1,
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

export interface SyncStopEvent extends SyncEvent {
    type: SyncEventsTypes.Stopped;
    terminated: true;
    hasErrors: true;
}

export interface SyncEvent {
    type: SyncEventsTypes;
    id: string;
    accountId: string;
}
