import path from 'path';


export const URLS = {
    appodealHome: 'https://www.appodeal.com',
    admobHome: 'https://apps.admob.com'
};

export function getPath (filePath: string = '') {
    return path.join(environment.development ? './' : process.resourcesPath, filePath);
}
