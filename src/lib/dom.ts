import {CSSProperties} from 'react';


export function classNames (...args: Array<any>): string {
    return args
        .map(arg => {
            if (typeof arg === 'string') {
                return arg;
            }
            if (arg instanceof Object) {
                return Object.entries(arg).reduce((filteredClasses, [className, value]) => {
                    if (value) {
                        filteredClasses.push(className);
                    }
                    return filteredClasses;
                }, []);
            }
            return '';
        })
        .flat()
        .join(' ')
        .replace(/\s{2,}/, ' ');
}

export function css (style: {[key: string]: string}): CSSProperties {
    return style as CSSProperties;
}
