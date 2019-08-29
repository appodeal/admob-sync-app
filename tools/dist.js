'use strict';

const yargs = require('yargs');
const builder = require('electron-builder/out/index');
const packageInfo = require('../package.json');
const buildConfig = packageInfo.build;
const path = require('path');
const fs = require('fs-extra');


let flags = yargs
    .option('mac-cert-name', {
        alias: 'mc',
        default: null,
        description: 'Name of the certificate from keychain "login"'
    })
    .argv;

const EXTENSIONS = {
    nsis: 'exe',
    dmg: 'dmg',
    deb: 'deb'
};


const targets = (targets => {
    if (buildConfig.win) {
        targets.win = [buildConfig.win.target];
    }
    if (buildConfig.mac) {
        targets.mac = [buildConfig.mac.target];
    }
    if (buildConfig.linux) {
        targets.linux = [buildConfig.linux.target];
    }
    return targets;
})({});

(async () => {

    const linuxAndMacBuild = await builder.build({
        linux: [buildConfig.linux.target],
        mac: [buildConfig.mac.target],
        publish: null,
        x64: true,
        config: {
            mac: {
                ...(buildConfig.mac || {}),
                identity: flags.macCertName
            }
        }
    }).catch((err) => {
        console.error(err);
        return [];
    });

    let winBuild = await builder.build({
        win: [buildConfig.win.target],
        publish: null,
        x64: true,
        ia32: true,
        config: {...buildConfig}
    }).catch((err) => {
        console.error(err);
        return [];
    });

    const results = [...linuxAndMacBuild, ...winBuild];

    if (results.length) {
        let distInfo = Object.keys(targets).reduce((info, platform) => {
                let fileRegexp = new RegExp(`\.${EXTENSIONS[targets[platform][0]]}$`),
                    fileName = results.find(name => fileRegexp.test(name)) || null;
                info[platform] = {
                    fileName
                };
                return info;
            }, {}),
            distFolder = path.resolve(__dirname, '..', buildConfig.directories.output),
            distFiles = new Set(Object.values(distInfo).map(info => info.fileName)),
            allDistFiles = (await fs.readdir(distFolder)).map(fileName => path.resolve(distFolder, fileName));
        await Promise.all(
            allDistFiles
                .filter(fileName => !distFiles.has(fileName))
                .map(fileName => fs.remove(path.resolve(distFolder, fileName)))
        );

        let {version, channel} = /^(?<version>\d+\.\d+\.\d+)(?:-(?<channel>[a-z]+))?$/.exec(packageInfo.version).groups,
            infoEntries;

        if (channel) {
            infoEntries = await Promise.all(
                Object.entries(distInfo)
                    .map(([platform, info]) => {
                        let newName = info.fileName.replace(/\d+\.\d+\.\d+/, `${version}-${channel}`);
                        return fs.rename(info.fileName, newName).then(() => {
                            info.fileName = newName;
                            return [platform, info];
                        });
                    })
            );
        } else {
            infoEntries = Object.entries(distInfo);
        }

        for (let [, info] of infoEntries) {
            info.version = [version, ...(channel ? [channel] : [])].join('-');
            info.fileName = info.fileName ? /\/(?<fileName>[^/]+)$/.exec(info.fileName).groups.fileName : null;
        }

        distInfo = objectFromEntries(infoEntries);

        await Promise.all([
            fs.writeFile(path.resolve(distFolder, './dist-info.json'), JSON.stringify(distInfo, null, 2))
        ]);
    }


})().catch(e => {
    console.error(e);
    process.exit(1);
});

function objectFromEntries (entries) {
    return entries.reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
    }, {});
}


