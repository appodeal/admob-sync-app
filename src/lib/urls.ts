import path from 'path';


let isPacked = true;

export function updateIsPacked (value) {
    isPacked = value;
}

export function getPath (filePath: string = '') {
    return  path.join(!isPacked ? './' : process.resourcesPath, filePath);
}
