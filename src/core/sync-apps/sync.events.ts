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
    percent: number;
    adUnitsCurrent: number;
    adUnitsTotal: number;
    failed?: number;
    step: number;
    log: string;
}

export interface SyncStopEvent extends SyncEvent {
    type: SyncEventsTypes.Stopped;
    terminated: true;
    hasErrors: true;
    isDisabled: false;
}

export interface SyncEvent {
    type: SyncEventsTypes;
    id: string;
    accountId: string;
}
