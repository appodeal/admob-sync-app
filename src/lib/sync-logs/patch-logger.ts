import {LoggerInstance} from 'lib/sync-logs/logger';
import {Logger} from 'winston';


/**
 * to await while file transport finish writing
 * https://github.com/jdthorpe/winston-log-and-exit/ or something doesnt work
 * @param logger
 */
export const patchLogger = (logger: Logger): LoggerInstance => {
    logger['closeAsync'] = () => new Promise(resolve => {
        logger.close();
        setTimeout(resolve, 100);
    });
    return <LoggerInstance>logger;
};
