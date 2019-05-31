export function decodeOctString (sourceStr: string) {
    if (sourceStr.includes('\'')) {
        throw new Error('invalid Source');
    }
    return (new Function('', `return '${sourceStr}'`))();
}
