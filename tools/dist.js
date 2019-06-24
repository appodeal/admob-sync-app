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
    .option('win-cert-file', {
        alias: 'cf',
        default: null,
        description: 'Path to *.pfx certificate file'
    })
    .option('win-cert-pass', {
        alias: 'cp',
        default: null,
        description: 'Password for certificate'
    })
    .argv;

const EXTENSIONS = {
    nsis: 'exe',
    dmg: 'dmg',
    deb: 'deb'
};

/**
 * Can contain following keys:
 * os - Operation system name (windows, mac-os, linux)
 * distName - Name of the dist file
 * name - Name of the package
 * version - Version of the package
 * ext - Extension of the dist file
 * @type {string}
 */
const DEFAULT_SYMLINK_TEMPLATE = '${os}';

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
    let results = await builder.build({
        ...targets,
        publish: null,
        config: {
            ...buildConfig,
            win: {
                ...(buildConfig.win || {}),
                certificateFile: flags.winCertFile,
                certificatePassword: flags.winCertPass
            },
            mac: {
                ...(buildConfig.mac || {}),
                identity: flags.macCertName
            }
        }

    }).catch((err) => {
        console.error(err);
        return [];
    });

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

        const resolveSymlinkName = (target) => {
            let data = {
                    get os () {
                        return getOsName(target);
                    },
                    get name () {
                        return packageInfo.name;
                    },
                    get distName () {
                        return distInfo[target].fileName;
                    },
                    get version () {
                        return packageInfo.version;
                    },
                    get ext () {
                        return distInfo[target].fileName.match(/\.(?<ext>[A-z0-9]+)$/).groups.ext;
                    }
                },
                template = packageInfo.symlinkName && packageInfo.symlinkName[target] || DEFAULT_SYMLINK_TEMPLATE;
            return template.replace(/\$\{([A-z]*)\}/g, (_, key) => data[key]);
        };

        await Promise.all([
            fs.writeFile(path.resolve(distFolder, './dist-info.json'), JSON.stringify(distInfo, null, 2)),
            // works only on UNIX systems
            fs.symlink(
                `./${distInfo.mac.fileName}`,
                path.resolve(distFolder, `./${resolveSymlinkName('mac')}`)
            ),
            fs.symlink(
                `./${distInfo.win.fileName}`,
                path.resolve(distFolder, `./${resolveSymlinkName('win')}`)
            ),
            fs.symlink(
                `./${distInfo.linux.fileName}`,
                path.resolve(distFolder, `./${resolveSymlinkName('linux')}`)
            )
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

function getOsName (target) {
    switch (target) {
    case 'win':
        return 'windows';
    case 'mac':
        return 'mac-os';
    case 'linux':
        return 'linux';
    }
}



