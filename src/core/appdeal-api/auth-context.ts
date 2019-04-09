import {ApolloLink} from 'apollo-link';
import {setContext} from 'apollo-link-context';
import jwt_decode from 'jwt-decode';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import {EventEmitter} from 'events';


export interface TokensInfo {
    accessToken: string;
    refreshToken: string;
}


export class AuthContext extends EventEmitter {

    private static TOKENS_FILE = 'appodeal-tokens';

    private static TOKENS: Map<string, TokensInfo>;

    static async init () {
        AuthContext.TOKENS = new Map(Object.entries(await getJsonFile(this.TOKENS_FILE, {})));
    }

    static async saveTokens (accountId: string, accessToken: string, refreshToken: string) {
        AuthContext.TOKENS.set(accountId, {
            accessToken,
            refreshToken
        });
        await saveJsonFile(AuthContext.TOKENS_FILE, [...AuthContext.TOKENS.entries()].reduce((tokens, [accountId, tokensInfo]) => {
            tokens[accountId] = tokensInfo;
            return tokens;
        }, {}));
    }

    static getTokens (accountId: string): TokensInfo {
        return AuthContext.TOKENS.get(accountId);
    }

    private accessToken: string = null;
    private refreshToken: string = null;
    private accountId: string = null;

    init (accountId: string) {
        this.setAccountId(accountId);
        this.setTokensInfo(AuthContext.getTokens(accountId));
        // check should we update refresh token each 1 minute
        setInterval(() => this.emitRefresh(), 60000);
        this.emitRefresh();
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
        console.debug('isTimeToRefresh', token, secondsNow);
        return token.rfr && token.rfr < secondsNow && secondsNow < token.exp;
    }

    remove () {
        return saveJsonFile(
            AuthContext.TOKENS_FILE,
            [...AuthContext.TOKENS.entries()]
                .filter(([accountId]) => accountId !== this.accountId)
                .reduce((data, [accountId, tokensInfo]) => {
                    data[accountId] = tokensInfo;
                    return data;
                }, {})
        );
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
}
