const args = require('args');
const fs = require('fs');
const {execSync} = require('child_process');

args
    .option('version', 'Extract project version', false)
    .option('hash', 'Extract last commit hash', false)
    .option('generate-info', 'Generate buildInfo.ts', false);

const flags = args.parse(process.argv);

function getPackage () {
    return JSON.parse(fs.readFileSync('./package.json').toString());
}

function getVersion () {
    return getPackage().version;
}

function getHash () {
    return execSync(`git rev-parse HEAD`).toString().trim();
}

if (flags.version) {
    process.stdout.write(getVersion());
} else if (flags.hash) {
    process.stdout.write(getHash());
} else if (flags.generateInfo) {
    fs.writeFileSync('src/environments/buildInfo.ts', `export const buildInfo = {version: '${getVersion()}', release: '${getHash()}'};\n`);
    console.log('Done');
}
