const fs = require('fs');


const envpath = '.envfile';
if (fs.existsSync(envpath)) {
    console.log(`Read env from ${envfile}`);
    require('dotenv').config({path: envpath});
}

function getVersion (tag) {
    if (!tag || !tag.trim()) {
        return '';
    }
    //  = trimLeft('v').
    return tag.replace(/^v/, '');
}

const tag = process.env.TAG;
if (!tag || !tag.trim()) {
    console.log('TAG env variable is not defined or empty!');
    console.log('VERSION is unchanged!');
    process.exit(0);
}

const pkg = require('package.json');
pkg.version = getVersion(tag);
fs.writeFileSync('package.json', JSON.stringify(pkg));
console.log(`VERSION from TAG env variable "${tag}" -> "${pkg.version}" is set to package.json`);
