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

/**
 * function is supposed to be stringifyed
 * @param element
 */
export function getElementSelector (element: HTMLElement): string {
    function isElement (el) {
        let isElem;

        if (typeof HTMLElement === 'object') {
            isElem = el instanceof HTMLElement;
        } else {
            isElem = !!el && (typeof el === 'object') && el.nodeType === 1 && typeof el.nodeName === 'string';
        }
        return isElem;
    }

    function getNthChild (element) {
        let counter = 0;
        let k;
        let sibling;
        const {parentElement} = element;

        if (Boolean(parentElement)) {
            const {childNodes} = parentElement;
            const len = childNodes.length;
            for (k = 0; k < len; k++) {
                sibling = childNodes[k];
                if (isElement(sibling)) {
                    counter++;
                    if (sibling === element) {
                        return `:nth-child(${counter})`;
                    }
                }
            }
        }
        return '';
    }


    let results = [];
    do {
        const id = element.getAttribute('id');

        if (id !== null && id !== '') {
            // if the ID starts with a number selecting with a hash will cause a DOMException
            results.push(id.match(/^\d/) ? `[id="${id}"]` : '#' + id);
            break;
        }

        const tag = element.tagName.toLowerCase().replace(/:/g, '\\:'),
            classes = Array.from(element.classList),
            selector = [tag, ...classes].join('.');

        if (selector.length) {
            results.push(selector + getNthChild(element));
        }
        element = element.parentElement;
    } while (element);

    return results.reverse().filter(v => v).join(' > ');

}
