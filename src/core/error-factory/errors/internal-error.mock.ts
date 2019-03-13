import {InternalError} from './internal-error';


export const randomError = new Error('randomError');
export const randomInternalError = new InternalError(randomError.message, randomError);

