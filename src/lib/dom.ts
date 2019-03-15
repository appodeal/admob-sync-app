import React, {CSSProperties} from 'react';


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

export function css (style: { [key: string]: string }): CSSProperties {
    return style as CSSProperties;
}

export function singleEvent (listener: (event?: Event) => any, context: any = undefined): (event: React.SyntheticEvent) => Promise<void> {
    return async (event: React.SyntheticEvent) => {
        let button = getButtonToDisable(event);
        if (button) {
            button.disabled = true;
        }
        await (async () => {
            await listener.call(context, event.nativeEvent);
        })().catch(err => {
            // TODO: handle error
        });
        if (button) {
            button.disabled = false;
        }
    };
}

function getButtonToDisable (event: React.SyntheticEvent): HTMLButtonElement {
    let target = event.target as Element;
    switch (event.type) {
    case 'submit':
        return target.querySelector('button[type="submit"]') as HTMLButtonElement;
    case 'click':
        return target.closest('button') as HTMLButtonElement;
    default:
        return target as HTMLButtonElement;
    }
}


export function getFormElement<T = HTMLInputElement> (form: HTMLFormElement, fieldName: string): T {
    return form.elements.namedItem(fieldName) as unknown as T;
}
