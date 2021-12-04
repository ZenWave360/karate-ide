import * as yml from 'js-yaml';
import * as vscode from 'vscode';
import { parseOpenAPI } from '../json-schema-ref-parser';
import { askForOperations, promptTargetFolder, promptToSaveFeature } from './OpenAPIGenerator';
import { findResourcesFolder, getOperationsFor, normalizeTag, operationsByTag, prepareData, render } from './OpenAPIGeneratorUtils';
import { buildKarateMockDataObject, buildKarateTestDataObject } from './test-data-generator';
const MOCKS_TEMPLATE = require('./templates/mock.template.feature.ejs');
const MOCKS_TEST_TEMPLATE = require('./templates/mock.test.template.feature.ejs');

export async function generateKarateMocksFromOpenAPI(file: vscode.Uri) {
    const api = await parseOpenAPI(file.fsPath);
    const operations = getOperationsFor(api);
    const selected = await askForOperations(operations);
    const resourcesFolder = await findResourcesFolder(file);
    const targetFolder = await promptTargetFolder(resourcesFolder);
    if (targetFolder && targetFolder[0]) {
        generateKarateMocks(file, api, targetFolder[0], selected);
    }
}

function generateKarateMocks(file: vscode.Uri, api, mocksFolder: vscode.Uri, operations: any[]) {
    const openapiFile = vscode.workspace.asRelativePath(file).replace(/\\/g, '/');
    vscode.workspace.fs.createDirectory(mocksFolder);

    Object.entries(operationsByTag(operations, api)).forEach(([tagName, operations]) => {
        const model: any = { api };
        model.openapiFile = openapiFile;
        model.operations = (operations as object[]).map(operation => prepareData(operation));
        model.apiName = normalizeTag(tagName) + 'Mock';

        render(MOCKS_TEMPLATE, vscode.Uri.joinPath(mocksFolder, model.apiName, `${model.apiName}.feature`), model);

        (operations as any[]).forEach(operation => {
            const operationName = operation.operationId;
            const statusCode = Object.keys(operation?.responses)[0];
            try {
                const testDataObject = buildKarateMockDataObject(operation, statusCode);
                vscode.workspace.fs.writeFile(
                    vscode.Uri.joinPath(mocksFolder, model.apiName, `${operationName}_${statusCode}.yml`),
                    Buffer.from(`${yml.dump(testDataObject)}`)
                );
            } catch (error) {
                vscode.workspace.fs.writeFile(
                    vscode.Uri.joinPath(mocksFolder, model.apiName, `${operationName}_${statusCode}.yml`),
                    Buffer.from(error)
                );
            }
        });
    });

    vscode.window.showInformationMessage(`Karate Mock features generated in: ${vscode.workspace.asRelativePath(mocksFolder, false)}`);
}

export async function generateKarateMockValidation(file: vscode.Uri) {
    const api = await parseOpenAPI(file.fsPath);
    const operations = getOperationsFor(api);
    const selected = await askForOperations(operations);
    const targetFile = await promptToSaveFeature();
    if (targetFile) {
        await generateKarateMockValidationTest(file, api, targetFile, selected);
    }
}

async function generateKarateMockValidationTest(file: vscode.Uri, api, targetFile: vscode.Uri, operations: any[]) {
    const openapiFile = vscode.workspace.asRelativePath(file).replace(/\\/g, '/');
    const model = { testName: 'Mock Validator Test', openapiFile, operations: [] };
    model.operations = operations.map(operation => {
        const payload = buildKarateTestDataObject(operation, Object.keys(operation?.responses)[0]);
        return {
            operation: prepareData(operation),
            statusCode: payload.statusCode,
            headers: {},
            params: payload.params,
            body: payload.body,
            matchResponse: true,
        };
    });
    render(MOCKS_TEST_TEMPLATE, targetFile, model);
    await vscode.window.showTextDocument(targetFile);
}
