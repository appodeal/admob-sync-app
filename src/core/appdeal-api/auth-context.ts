import {ApolloLink} from 'apollo-link';
import {setContext} from 'apollo-link-context';
import {EventEmitter} from 'events';
import jwt_decode from 'jwt-decode';
import {JsonStorage} from '../json-storage/json-storage.interface';


export interface TokensInfo {
    accessToken: string;
    refreshToken: string;
}


export class AuthContext extends EventEmitter {

    private static TOKENS_FILE = 'appodeal-tokens';

    private static TOKENS: Map<string, TokensInfo>;

    private static storage: JsonStorage;

    public static readonly ready: Promise<void> = new Promise(() => {});

    static async init (storage: JsonStorage) {
        // @ts-ignore
        return AuthContext.ready = new Promise<void>(async r => {
            AuthContext.storage = storage;
            AuthContext.TOKENS = new Map(Object.entries(await AuthContext.storage.load(this.TOKENS_FILE, {})));
            r();
        });
    }

    static async saveTokens (accountId: string, accessToken: string, refreshToken: string) {
        AuthContext.TOKENS.set(accountId, {
            accessToken,
            refreshToken
        });
        await AuthContext.saveTokensToFile();
    }

    private static saveTokensToFile () {
        return AuthContext.storage.save(
            AuthContext.TOKENS_FILE,
            [...AuthContext.TOKENS.entries()].reduce((tokens, [accountId, tokensInfo]) => {
                tokens[accountId] = tokensInfo;
                return tokens;
            }, {})
        );
    }

    static getTokens (accountId: string): TokensInfo {
        return AuthContext.TOKENS.get(accountId);
    }

    private accessToken: string = null;
    private refreshToken: string = null;
    private accountId: string = null;
    private refreshInterval = null;

    init (accountId: string) {
        this.setAccountId(accountId);
        let tokens = AuthContext.getTokens(accountId);
        if (tokens) {
            console.log(`auth tokens for ${accountId} successfully loaded`);
            this.setTokensInfo(tokens);
        } else {
            console.log(`NO auth tokens for ${accountId}`);
        }
        // check should we update refresh token each 1 minute
        this.refreshInterval = setInterval(() => this.emitRefresh(), 60000);
        this.emitRefresh();
    }

    isInitialized (): boolean {
        return Boolean(this.accessToken && this.refreshToken);
    }

    private emitRefresh () {
        if (this.isTimeToRefresh()) {
            this.emit('refresh', this.refreshToken);
        }
    }


    private isTimeToRefresh (): boolean {
        if (!this.refreshToken) {
            // nothing to refresh
            return false;
        }
        let token = jwt_decode<{ rfr: number, exp: number }>(this.refreshToken),
            secondsNow = Date.now() / 1000;
        if (token.rfr && token.rfr < secondsNow && secondsNow < token.exp) {
            console.debug('isTimeToRefresh', token, secondsNow);
            return true;
        }
        return false;
    }

    remove () {
        console.log(`auth tokens for ${this.accountId} have been deleted`);
        if (AuthContext.TOKENS.has(this.accountId)) {
            // if new token is here we should not delete it
            if (AuthContext.TOKENS.get(this.accountId).accessToken === this.accessToken) {
                AuthContext.TOKENS.delete(this.accountId);
            }
        }
        this.refreshToken = null;
        this.accessToken = null;

        return AuthContext.saveTokensToFile();
    }

    setTokensInfo ({accessToken, refreshToken}: { accessToken: string, refreshToken: string }) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }

    setAccountId (accountId: string) {
        this.accountId = accountId;
    }

    save () {
        AuthContext.saveTokens(this.accountId, this.accessToken, this.refreshToken);
    }

    createLink (): ApolloLink {
        return setContext((_, {headers}) => {
            return {
                headers: {
                    ...headers,
                    authorization: this.accessToken ? `Bearer ${this.accessToken}` : ''
                }
            };
        });
    }

    destroy () {
        clearInterval(this.refreshInterval);
        this.removeAllListeners();
    }
}
