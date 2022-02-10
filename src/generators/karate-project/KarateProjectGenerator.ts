import * as path from 'path';
import * as AdmZip from 'adm-zip';
import { promptTargetFolder } from '../openapi/OpenAPIGenerator';
const templatesZipFile = require('./templates/karate-project.zip');

export async function generateKarateProject() {
    const promptFolderArray = await promptTargetFolder();
    if (promptFolderArray && promptFolderArray.length === 1) {
        const targetFolder = promptFolderArray[0].fsPath;
        const zip = new AdmZip(path.join(__dirname, templatesZipFile));
        zip.extractAllTo(targetFolder, /*overwrite*/ false);
    }
}
