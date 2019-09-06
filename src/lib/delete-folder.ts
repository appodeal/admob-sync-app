import * as fs from "fs-extra";

// safe delete. skip locked resourses
export function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        let canDelete = true
        fs.readdirSync(path).forEach(function(file){
            try {
                var curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                    deleteFolderRecursive(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            } catch (e) {
                console.error(e)
                canDelete = false
            }
        });
        if (canDelete) {
            fs.rmdirSync(path);
        }
    }
};

