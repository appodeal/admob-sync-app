
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
        this.messages.push(`${(new Date()).toJSON()} [${level}] ${args.map(formatArg).join(', ')}`);
        consoleFallback(...args);
    };

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
