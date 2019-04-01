import {ApolloLink} from 'apollo-link';
import {setContext} from 'apollo-link-context';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import jwt_decode from 'jwt-decode';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';


export class AuthContext {

    static tokensFile = 'appodealtokens';

    private accessToken: string = null;
    private refreshToken: string = null;

    constructor (private api: AppodealApiService) {
    }

    async loadFromFile () {
        const tokens = await getJsonFile(AuthContext.tokensFile);
        if (tokens) {
            await this.setAccessTokens(tokens, false);
            console.log('Appodeal AuthContext loaded from file');
        } else {
            console.log('Appodeal AuthContext NO saved tokens');
        }
    }

    async saveToFile () {
        if (this.accessToken && this.refreshToken) {
            await saveJsonFile(AuthContext.tokensFile, {
                accessToken: this.accessToken,
                refreshToken: this.refreshToken
            });
        }
    }

    async init () {
        await this.loadFromFile();
        // check should we update refresh token each 1 minutes
        setInterval(() => this.checkRefreshToken(), 1 * 60 * 1000);
        this.checkRefreshToken();
    }


    async checkRefreshToken () {
        if (!this.refreshToken) {
            // nothing to refresh
            return;
        }
        try {
            const token = jwt_decode<{ rfr: number, exp: number }>(this.refreshToken);
            const nowMilliseconds = Date.now() / 1000;
            console.debug('checkRefreshToken', token, nowMilliseconds);
            if (token.rfr && token.rfr < nowMilliseconds && nowMilliseconds < token.exp) {
                console.log('attempt to refresh token');
                await this.api.refreshAccessToken(this.refreshToken);
                console.log('access token refreshed');
            }
        } catch (e) {
            console.log(`failed to refresh access token`, e);
        }
    }

    async setAccessTokens ({accessToken, refreshToken}, autoSave = true) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        if (autoSave) {
            return this.saveToFile();
        }
    }

    invalidateAccessToken () {
        this.accessToken = null;
        this.refreshToken = null;
        return saveJsonFile(AuthContext.tokensFile, null);
    }


    storeSessionFromResponse = (data: { accessToken, refreshToken }) => {
        if (data) {
            this.setAccessTokens(data);
        }
        return data;
    };


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
