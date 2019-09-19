import compareVersions from 'compare-versions';


/**
 * app version is 0.0.n
 * plugin version is 20.0.n already.
 * to keep updated minimal version  for app & plugin in sync we have this dirty hack
 * @param original
 */
export function patchMinimalVersion (original: string) {
    const chunks = original.split('.');
    chunks[0] = String(parseInt(chunks[0], 10) + 20);
    return chunks.join('.');
}


export function getExtensionVersion () {
    return chrome.runtime.getManifest().version;
}

export function isUpdateRequired (minimalVersion: string): boolean {
    return (compareVersions(minimalVersion, getExtensionVersion()) === 1);
}
