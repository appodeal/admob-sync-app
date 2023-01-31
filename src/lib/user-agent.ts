export function cutElectronFromUserAgent (originalUA: string): string {
    let match = originalUA.match(/(?<platform>[^\)]+)\).*/);
    if (!match || !match.groups.platform) {
        // invalid UA we cant help here
        return originalUA;
    }
    let platformInfo = match.groups.platform;
    if (platformInfo.toLowerCase().includes('mac')) {
        const chunks = platformInfo.split(' ');
        chunks[chunks.length - 1] = chunks[chunks.length - 1].split('_').filter((_, i) => i < 2).join('.');
        platformInfo = chunks.join(' ');
    }
    return `${platformInfo}; rv:109.0) Gecko/20100101 Firefox/109.0`;
}
