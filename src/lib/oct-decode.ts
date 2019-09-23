export function decodeOctString (sourceStr: string) {
    if (sourceStr.includes('\'')) {
        throw new Error('invalid Source');
    }
    try {
        return (new Function('', `return '${sourceStr}'`))();
    } catch (e) {
        console.log(e);
        return sourceStr.replace(/\\x([A-Za-z0-9]{2})/g, (r, v) => String.fromCharCode(parseInt(v, 16)));
    }
}
