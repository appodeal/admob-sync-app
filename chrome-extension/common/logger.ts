import PushStream from 'zen-push';


function formatArg (v: any) {
    switch (typeof v) {
    case 'number':
    case 'string':
        return v;
    default:
        JSON.stringify(v);
    }
}

export class Logger {

    messages = [];

    handler = (level, consoleFallback) => (...args) => {
        const message = `${(new Date()).toJSON()} [${level}] ${args.map(formatArg).join(', ')}`;
        this.messages.push(message);
        this.events.next(message);
        consoleFallback(...args);
    };
    public events = new PushStream<string>();


    info = this.handler('INFO', console.log.bind(console));
    log = this.handler('INFO', console.log.bind(console));
    error = this.handler('ERROR', console.error.bind(console));
    warn = this.handler('WARN', console.warn.bind(console));
    warning = this.handler('WARN', console.warn.bind(console));
    debug = this.handler('DEBUG', console.debug.bind(console));

    getAsText () {
        return this.messages.join('\n');
    }

    clean () {
        this.messages = [];
    }

}
