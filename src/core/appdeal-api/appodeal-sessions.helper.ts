import {Session, session} from 'electron';
import {UserAccount} from 'interfaces/common.interfaces';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import uuid from 'uuid';
import {removeSession} from '../../lib/sessions';


export namespace AppodealSessions {

    const FILE_NAME = 'appodeal-sessions';

    let SESSIONS: Map<string, string>;

    export let DEFAULT_SESSION: Session;

    export function init () {
        DEFAULT_SESSION = session.fromPartition('persist:appodeal_default');
        return getJsonFile<{ [key: string]: string }>(FILE_NAME).then(sessionsData => {
            SESSIONS = sessionsData ? new Map(Object.entries(sessionsData)) : new Map();
        });
    }

    function fromPartition (sessionID: string) {
        return session.fromPartition(`persist:${sessionID}`);
    }

    export function create (): { id: string, session: Session, save (accountId: string): Promise<void>, remove (): Promise<void> } {
        let id = `appodeal_${uuid.v4()}`,
            session = fromPartition(id);
        return {
            id,
            session,
            save (accountId: string) {
                SESSIONS.set(accountId, id);
                return saveSessions();
            },
            remove () {
                return removeSession(session, id);
            }
        };
    }

    export function get (account: UserAccount | string): Session {
        let accountId = account instanceof Object ? account.id : account;
        if (SESSIONS.has(accountId)) {
            return fromPartition(SESSIONS.get(accountId));
        }
        return null;
    }

    function saveSessions () {
        return saveJsonFile(FILE_NAME, [...SESSIONS.entries()].reduce((acc, [accId, sessionId]) => {
            acc[accId] = sessionId;
            return acc;
        }, {}));
    }


    export async function remove (accountId: string): Promise<void> {
        let sessionId = SESSIONS.get(accountId);
        if (sessionId) {
            await removeSession(fromPartition(sessionId), sessionId);
            SESSIONS.delete(accountId);
            await saveSessions();
        }
    }


}
