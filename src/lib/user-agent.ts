import packageInfo from '../../package.json';


export function cutElectronFromUserAgent (originalUA: string): string {
    let appName = packageInfo.productName.split(' ').join(''),
        electron = 'Electron';
    return originalUA.split(' ').filter(text => !(text.match(appName) || text.match(electron))).join(' ');
}
