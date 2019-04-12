const Github = require('github');
const moment = require('moment');
const pkg = require('./../package.json');
const exec = require('child_process').exec;

function getRepoParams(url) {
    let result = url.split('/');
    return {repo: result.pop(), owner: result.pop()};
}

exec('git rev-parse --abbrev-ref HEAD', (error, branch) => {
    if (error) {
        console.log(error.message || error);
        process.exit(1)
    }
    if (branch.trimRight().trimLeft() !== 'master') {
        console.log("Can release only from master branch");
        process.exit(1)
    }
    exec('git config --global github.token', (error, token) => {
        if (error) {
            console.log(error.message || error);
            process.exit(1)
        }

        const github = new Github({
            debug: false,
            host: "api.github.com",
            protocol: "https",
            version: "3.0.0",
            pathPrefix: null
        });

        github.authenticate({
            type: 'oauth',
            token: token.trimRight().trimLeft()
        });

        let repo = getRepoParams(pkg.repository);

        github.releases.createRelease({
            owner: repo.owner,
            repo: repo.repo,
            tag_name: 'v' + pkg.version,
            name: `Release ${moment().format("D MMM YYYY")}`,
            target_commitish: 'master'
        }, (error, response) => {
            if (error) {
                let {message} = error;
                let originalError = JSON.parse(message);
                originalError.errors.forEach(error => {
                    console.log(`Error: ${error.resource} -> ${error.code}`)
                });
                process.exit(1)
            } else {
                console.log(response.html_url)
            }
        })
    });
});
