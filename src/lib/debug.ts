import {Debugger} from 'electron';
import {getElementSelector} from './dom';
import {retry} from './retry';


type NodeIdOrSelector = number | string;


export class Debug {
    private networkTrackingEnabled = false;

    constructor (private debug: Debugger) {

    }

    getDocument () {
        return this.exec('DOM.getDocument', 'root');
    }

    async querySelector (selector: string, fromNodeId: number = null): Promise<number> {
        if (fromNodeId === null) {
            let {nodeId} = await this.getDocument();
            fromNodeId = nodeId;
        }
        return this.exec('DOM.querySelector', 'nodeId', {selector, nodeId: fromNodeId});
    }

    async querySelectorAll (selector: string, fromNodeId: number = null): Promise<Array<number>> {
        if (fromNodeId === null) {
            let {nodeId} = await this.getDocument();
            fromNodeId = nodeId;
        }
        return this.exec('DOM.querySelectorAll', 'nodeIds', {selector, nodeId: fromNodeId});
    }

    getNode (nodeId: number): Promise<{ value: any }> {
        return this.exec('DOM.resolveNode', 'object', {nodeId});
    }

    async getHTML (nodeIdOrSelector: NodeIdOrSelector) {
        return retry(async () => {
            let nodeId = await this.resolveNodeId(nodeIdOrSelector);
            let outer = await this.exec('DOM.getOuterHTML', 'outerHTML', {nodeId});
            return {
                outer,
                inner: />(?<inner>.*)<\//.exec(outer).groups.inner.trim()
            };
        }, 3, 500);
    }

    getInnerHTML (nodeIdOrSelector: NodeIdOrSelector): Promise<string> {
        return this.getHTML(nodeIdOrSelector).then(html => html.inner);
    }

    getTextContents (selector: string): Promise<Array<string>> {
        return this.exec('Runtime.evaluate', 'result', {
            returnByValue: true,
            expression: `[...document.querySelectorAll('${selector}')].map(el => el.textContent);`
        })
            .then(result => result.value);
    }

    async focus (nodeId: number): Promise<void> {
        return this.exec('DOM.focus', null, {nodeId});
    }

    async enterText (text: string, nodeIdOrSelector: NodeIdOrSelector): Promise<void> {
        let inputNodeId = await retry(async () => {
            let inputNodeId = await this.resolveNodeId(nodeIdOrSelector);
            if (inputNodeId) {
                await this.focus(inputNodeId);
                if (nodeIdOrSelector !== inputNodeId) {
                    await this.exec('Runtime.evaluate', null, {
                        expression: `document.querySelector('${nodeIdOrSelector}').select();`
                    }).catch(() => {});
                }
            }
            return inputNodeId;
        }, 3, 500);
        if (inputNodeId) {
            await text.split('')
                .reduce((promise, char) => {
                    return promise.then(() => this.enterSymbol(char));
                }, Promise.resolve());
        }
    }

    async enterSymbol (symbol: string): Promise<void> {
        let config = {
            nativeVirtualKeyCode: symbol.charCodeAt(0),
            unmodifiedText: symbol,
            text: symbol,
            modifiers: (symbol !== symbol.toLowerCase() || !/[^A-z0-9]/i.test(symbol)) ? 8 : 0
        };
        await this.exec('Input.dispatchKeyEvent', null, {...config, type: 'rawKeyDown'});
        await this.exec('Input.dispatchKeyEvent', null, {...config, type: 'char'});
        await this.exec('Input.dispatchKeyEvent', null, {...config, type: 'keyUp'});
    }

    async emulateEnter () {
        await this.enterSymbol('\r');
    }

    async click (nodeIdOrSelector: NodeIdOrSelector) {
        const {cx, cy} = await retry(async () => {
            let nodeId = await this.resolveNodeId(nodeIdOrSelector);
            return this.getNodeRect(nodeId);
        }, 3, 500);
        await this.exec('Input.dispatchMouseEvent', null, {
            type: 'mousePressed',
            button: 'left',
            buttons: 1,
            x: cx,
            y: cy,
            clickCount: 1
        });
        await this.exec('Input.dispatchMouseEvent', null, {
            type: 'mouseReleased',
            button: 'left',
            buttons: 1,
            x: cx,
            y: cy,
            clickCount: 1
        });
    }

    async getNodeRect (nodeIdOrSelector: NodeIdOrSelector) {
        let nodeId = await this.resolveNodeId(nodeIdOrSelector);
        let [quads] = await this.exec<Array<Array<number>>>('DOM.getContentQuads', 'quads', {nodeId});
        let [x1, y1, x2, y2, , y3] = quads;
        return {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y3 - y2,
            top: y1,
            bottom: y3,
            left: x1,
            right: x2,
            cx: Math.round(x1 + (x2 - x1) / 2),
            cy: Math.round(y1 + (y3 - y2) / 2)
        };
    }

    exec<T = any> (method: string, property: string, args = {}): Promise<T> {
        return new Promise((resolve, reject) => {
            this.debug.sendCommand(method, args, (error, result) => {
                setImmediate(() => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(property ? result[property] : result);
                    }
                });
            });
        });
    }

    wait (time: number) {
        return new Promise(resolve => setTimeout(() => resolve(), time));
    }

    /**
     * wait until condition return true or maxTime
     * @param condition
     * @param maxTime
     */
    waitCondition (condition: () => boolean | Promise<boolean>, maxTime = 20000): Promise<void> {
        return new Promise((resolve, reject) => {
            let lastError;
            let timeout = setTimeout(() => {
                clearTimeout(interval);
                console.warn('[waitCondition] last Error', lastError);
                reject(new Error(`Can't wait condition '${condition}' during ${maxTime}ms`));
            }, maxTime);
            let check = () => setTimeout(async () => {
                let result;
                try {
                    result = await condition();
                } catch (e) {
                    lastError = e;
                    result = false;
                }
                if (result) {
                    clearTimeout(timeout);
                    return setTimeout(() => resolve(), 500);
                }
                interval = check();
            }, 500);

            let interval = check();
        });
    }

    waitElement (selector: string, maxTime = 20000): Promise<number> {
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                clearTimeout(interval);
                reject(new Error(`Can't find element by selector '${selector}' during ${maxTime}ms`));
            }, maxTime);
            let check = () => {
                return setTimeout(async () => {
                    let nodeId = await this.querySelector(selector);
                    if (nodeId) {
                        clearTimeout(timeout);
                        setTimeout(() => resolve(nodeId), 500);
                    } else {
                        interval = check();
                    }
                }, 500);
            };
            let interval = check();
        });

    }

    waitElementVisible (selector: string, maxTime = 20000) {
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                clearTimeout(interval);
                reject(new Error(`Can't find element by selector '${selector}' during ${maxTime}ms`));
            }, maxTime);
            let check = () => {
                return setTimeout(async () => {
                    let nodeId = await this.querySelector(selector),
                        rect = await this.getNodeRect(nodeId).catch(() => null);
                    if (nodeId && rect) {
                        clearTimeout(timeout);
                        setTimeout(() => resolve(nodeId), 500);
                    } else {
                        interval = check();
                    }
                }, 1500);
            };
            let interval = check();
        });
    }

    isElementExistsAndVisible (selector: string, maxTime?: number): Promise<boolean> {
        return this.waitElementVisible(selector, maxTime)
            .then(() => true)
            .catch(() => false);
    }

    async scrollIntoView (selector: string) {
        await this.exec('Runtime.evaluate', null, {
            expression: `document.querySelector('${selector}').scrollIntoView()`
        }).catch(() => {});
        await this.wait(300);
    }

    evaluate (script: string, property: string = null) {
        return this.exec('Runtime.evaluate', property, {
            expression: script,
            awaitPromise: true
        });
    }

    /**
     * build uniq element selector
     * @param selector
     * @param innerText
     */
    async findElementUniqSelector (selector: string, innerText: string): Promise<string> {
        return this.evaluate(`                
                    new Promise((resolve, reject) => {
                        let getElementSelector = ${getElementSelector.toString()}                       
                        let target = [...document.querySelectorAll('${selector}')].find( a => a.innerText.trim() === '${innerText}');                                         
                        
                        if (target) {
                            return resolve(getElementSelector(target))
                        }
                        reject();
                    });
                `, 'result')
            .then(result => result.value)
            .catch(e => {
                console.warn(e);
                throw e;
            });
    }

    getCurrentUrl () {
        return this.exec('Runtime.evaluate', 'result', {
            expression: `location.href;`
        })
            .then(result => result.value)
            .catch(() => '');
    }

    async navigate (url: string) {
        return this.exec('Page.navigate', null, {url});
    }

    private async resolveNodeId (nodeIdOrSelector: NodeIdOrSelector): Promise<number> {
        if (typeof nodeIdOrSelector === 'number') {
            return nodeIdOrSelector;
        }
        return this.querySelector(nodeIdOrSelector);
    }

    waitForResponseFrom (url: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            if (!this.networkTrackingEnabled) {
                await this.exec('Network.enable', null)
                    .then(() => this.networkTrackingEnabled = true)
                    .catch(err => reject(err));
            }
            let requestId = await this.getRequestId(url);
            this.exec('Network.getResponseBody', 'body', {requestId})
                .then(body => resolve(body))
                .catch(err => reject(err));
        });

    }

    private getRequestId (url) {
        return new Promise((resolve, reject) => {
            let requestId,
                timer = setTimeout(() => {
                    this.debug.removeListener('message', listener);
                    reject(new Error(`Can't get response id for "${url}" during 20 sec`));
                }, 20000),
                listener = (event, method, params) => {
                    if (!requestId && method === 'Network.requestWillBeSent' && params.request.url === url) {
                        requestId = params.requestId;
                    }
                    if (requestId && method === 'Network.loadingFinished' && params.requestId === requestId) {
                        this.debug.removeListener('message', listener);
                        clearTimeout(timer);
                        resolve(requestId);
                    }
                };
            this.debug.on('message', listener);
        });
    }

}
