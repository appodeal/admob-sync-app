import {ITranslator} from './translator.interface';

interface BiddingState {
    1: number
}

export class BiddingTranslator implements ITranslator {

    decode (v: BiddingState): boolean {
        return v[1] === 2;
    }

    encode (v: boolean): BiddingState {
        if (v === null) {
            return this.formatting(1);
        }
        return v ? this.formatting(2) : this.formatting(1);
    }

    formatting (state: number): BiddingState {
        return {1: state};
    }
}
