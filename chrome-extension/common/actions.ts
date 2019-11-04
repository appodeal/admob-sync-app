export enum Actions {
    fetch = 'fetch',
    getEnv = 'getEnv',
    getExtensionState = 'getExtensionState',
    extensionStateUpdated = 'extensionStateUpdated',
    openAdmobTab = 'openAdmobTab',
    updateAdmobAccountCredentials = 'updateAdmobAccountCredentials',
    updateAdmobAccountCredentialsUpdated = 'updateAdmobAccountCredentialsUpdated',
    updateAdmobAccountCredentialsOAuthCallbackVisited = 'updateAdmobAccountCredentialsOAuthCallbackVisited',
    isSyncProgressVisible = 'isSyncProgressVisible',
    syncProgressUpdated = 'syncProgressUpdated',
    syncProgressFinishMessage = 'syncProgressFinishMessage',
    syncLogMessage = 'syncLogMessage',
    ping = 'ping',
    pong = 'pong',
    sendLogs = 'sendLogs',
    runJob = 'runJob'
}


export enum TabJobs {
    Idle = 'idle',
    enableReporting = 'enableReporting',
    syncAdunits = 'syncAdunits'
}
