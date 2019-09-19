export function decodeOctString (sourceStr: string) {
    if (sourceStr.includes('\'')) {
        throw new Error('invalid Source');
    }
    return sourceStr.replace(/\\x([A-Za-z0-9]{2})/g, (r, v) => String.fromCharCode(parseInt(v, 16)));
}
