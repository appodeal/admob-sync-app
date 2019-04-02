export function isMacOS (): boolean {
    return process.platform === 'darwin';
}

export function isWindows (): boolean {
    return process.platform === 'win32';
}

export function isLinux (): boolean {
    return process.platform === 'linux';
}

export function getOsName () {
    switch (process.platform) {
    case 'linux':
        return 'linux';
    case 'darwin':
        return 'mac';
    case 'win32':
        return 'win';
    default:
        return process.platform;
    }
}
