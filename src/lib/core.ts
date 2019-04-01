export function deepAssign<T> (target, ...sources): T {
    for (let source of sources) {
        for (let [key, value] of Object.entries(source)) {
            if (value && typeof value === 'object' && value.constructor === Object) {
                target[key] = deepAssign(target[key] || {}, value);
            } else {
                target[key] = value;
            }
        }
    }
    return target;
}
