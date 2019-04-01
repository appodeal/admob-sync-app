import path from 'path';


export const URLS = {
    appodealHome: 'https://www.appodeal.com',
    admobHome: 'https://apps.admob.com',
    updates: 'http://localhost:8083',
    releaseNotes: 'https://wiki.appodeal.com'
};

export function getPath (filePath: string = '') {
    return path.join(environment.development ? './' : process.resourcesPath, filePath);
}
