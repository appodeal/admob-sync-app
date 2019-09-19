import {app, Session} from 'electron';
import fs from 'fs-extra';
import path from 'path';


export async function removeSession (session: Session, sessionId: string) {
    if (typeof session['destroy'] === 'function') {
        await session['destroy']();
    }
    session.removeAllListeners();
    await fs.remove(path.resolve(app.getPath('userData'), `./Partitions/${sessionId}`))
        .catch(err => console.error(err));
}
