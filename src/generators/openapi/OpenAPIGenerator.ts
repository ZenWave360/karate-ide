// import * as $RefParser from '@apidevtools/json-schema-ref-parser';
import * as fs from 'fs';
import * as yml from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseOpenAPI } from '../json-schema-ref-parser';
import {
    findResourcesFolder,
    getOperationsFor,
    normalizeTag,
    padCellsForTabularData,
    prepareData,
    render,
    serviceName,
} from './OpenAPIGeneratorUtils';
import { buildKarateTestDataObject, buildParametersSample } from './test-data-generator';
const testTemplateFile = require('./templates/test.template.feature.ejs');
const karateAuthTemplateFile = require('./templates/karate-auth.js.ejs');

export async function generateKarateTestFromOpenAPI(file: vscode.Uri) {
    const api = await parseOpenAPI(file.fsPath);
    const operations = getOperationsFor(api);
    const selected = await askForOperations(operations);
    const resourcesFolder = await findResourcesFolder(file);
    const targetFolder = await promptTargetFolder(resourcesFolder);
    if (targetFolder && targetFolder[0]) {
        generateKarateTest(file, api, targetFolder[0], selected);
    }
}

export async function askForOperations(operations: { label: string; description: string; value: any }[]) {
    const selected = await vscode.window.showQuickPick(operations, { canPickMany: true });
    return selected.map(s => s.value);
}

export async function promptTargetFolder(defaultFolder?: vscode.Uri) {
    return await vscode.window.showOpenDialog({
        canSelectMany: false,
        canSelectFolders: true,
        canSelectFiles: false,
        defaultUri: defaultFolder,
        openLabel: 'Select Folder',
    });
}

export async function promptToSaveFeature(title = 'Save Karate Test File') {
    return await vscode.window.showSaveDialog({
        title,
        defaultUri: null,
        saveLabel: 'Select File',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        filters: { 'Karate Features': ['feature'] },
    });
}

async function generateKarateTest(file, api, apisFolder: vscode.Uri, operations: any[]) {
    const openapiFile = vscode.workspace.asRelativePath(file).replace(/\\/g, '/');
    vscode.workspace.fs.createDirectory(apisFolder);
    operations.forEach(operation => {
        const model: any = { api, operationId: operation.operationId };
        model.openapiFile = openapiFile;
        model.operation = prepareData(operation);
        model.serviceName = serviceName(operation);
        const payload = buildKarateTestDataObject(model.operation, Object.keys(model?.operation?.responses)[0]);
        model.payload = { statusCode: payload.statusCode, headers: {}, params: payload.params, body: payload.body, matchResponse: true };
        model.responseMatch = payload.responseMatch;
        model.responseMatchesEach = payload.responseMatchesEach;

        vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(apisFolder, model.serviceName));

        Object.keys(model.operation.responses).forEach(statusCode => {
            if (statusCode !== '500') {
                if (operation.method === 'get' || operation.method === 'delete') {
                    model.operation.paramNames = operation.parameters.map(p => p.name);
                    model.operation.responses[statusCode].paramExamples = Object.values(buildParametersSample(operation.parameters));
                } else {
                    try {
                        const testDataObject = buildKarateTestDataObject(model.operation, statusCode);
                        delete testDataObject.responseMatch;
                        delete testDataObject.responseMatchesEach;
                        vscode.workspace.fs.writeFile(
                            vscode.Uri.joinPath(apisFolder, model.serviceName, 'test-data', `${model.operationId}_${statusCode}.yml`),
                            Buffer.from(`${yml.dump(testDataObject)}`)
                        );
                    } catch (error) {
                        vscode.workspace.fs.writeFile(
                            vscode.Uri.joinPath(apisFolder, model.serviceName, 'test-data', `${model.operationId}_${statusCode}.yml`),
                            Buffer.from(error)
                        );
                    }
                }
            }
        });

        if (operation.method === 'get' || operation.method === 'delete') {
            try {
                padCellsForTabularData(model.operation.paramNames, model.operation.responses);
            } catch (e) {
                console.error(e);
            }
        }

        render(testTemplateFile, vscode.Uri.joinPath(apisFolder, model.serviceName, `${model.operationId}.feature`), model);
    });

    // TODO choose wise where to put the auth file
    const resourcesRoot = await findResourcesFolder(file);
    const karateAuthFile = vscode.Uri.joinPath(resourcesRoot, 'karate-auth.js');
    if (!fs.existsSync(karateAuthFile.fsPath)) {
        fs.copyFileSync(path.join(__dirname, karateAuthTemplateFile), karateAuthFile.fsPath);
    }

    vscode.window.showInformationMessage(`Karate Test features generated in: ${vscode.workspace.asRelativePath(apisFolder, false)}`);
}

