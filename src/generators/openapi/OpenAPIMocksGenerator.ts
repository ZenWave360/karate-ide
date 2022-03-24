import * as vscode from 'vscode';
import * as _ from 'lodash';
import { parseOpenAPI } from '../json-schema-ref-parser';
import { askForOperations, promptToSaveFeature } from './OpenAPIGenerator';
import { getOperationsFor, prepareData, render } from './OpenAPIGeneratorUtils';
import { buildKarateTestDataObject } from './test-data-generator';
export const MOCKS_TEMPLATE = require('./templates/mock.feature.ejs');
const MOCKS_TEST_TEMPLATE = require('./templates/mock-test.feature.ejs');

export async function generateKarateMocksFromOpenAPI(file: vscode.Uri) {
    const api = await parseOpenAPI(file.fsPath);
    const operations = getOperationsFor(api);
    const selected = await askForOperations(operations);
    const targetFile = await promptToSaveFeature();
    if (targetFile) {
        try {
            await generateKarateStatefulMock(file, api, targetFile, selected);
        } catch (e) {
            console.error(e);
            vscode.window.showErrorMessage(e.message);
        }
    }
}

async function generateKarateStatefulMock(file: vscode.Uri, api, targetFile: vscode.Uri, operations: any[]) {
    const openapiFile = vscode.workspace.asRelativePath(file).replace(/\\/g, '/');
    const model = { testName: 'Karate Stateful Mock', openapiFile, operations: [], varNames: [], pathVarMap: {} };
    model.operations = operations.map(operation => prepareData(operation));
    model.varNames = _.uniq(operations.reduce((dtoNames, operation) => [...dtoNames, operation.responseDtoNamePlural], []).filter(dto => dto));
    model.operations.forEach(operation => {
        if (operation.responseDtoNamePlural) {
            model.pathVarMap[operation.path] = operation.responseDtoNamePlural;
        }
        operation.pathParm = Object.keys(operation.pathParams || {}).length > 0 ? Object.keys(operation.pathParams)[0] : null;
        if (operation.responseSchema) {
            const properties = operation.responseIsArray ? operation.responseSchema.items?.properties : operation.responseSchema.properties;
            operation.responseDtoId = properties ? (properties.hasOwnProperty('id') ? 'id' : Object.keys(properties)[0]) : null;
        }
    });
    await render(MOCKS_TEMPLATE, targetFile, model);
    await vscode.window.showTextDocument(targetFile);
}

export async function generateKarateMockValidation(file: vscode.Uri) {
    const api = await parseOpenAPI(file.fsPath);
    const operations = getOperationsFor(api);
    const selected = await askForOperations(operations);
    const targetFile = await promptToSaveFeature();
    if (targetFile) {
        try {
            await generateKarateMockValidationTest(file, api, targetFile, selected);
        } catch (e) {
            console.error(e);
            vscode.window.showErrorMessage(e.message);
        }
    }
}

async function generateKarateMockValidationTest(file: vscode.Uri, api, targetFile: vscode.Uri, operations: any[]) {
    const openapiFile = vscode.workspace.asRelativePath(file).replace(/\\/g, '/');
    const model = { testName: 'Mock Validator Test', baseUrl: 'baseUrl', openapiFile, operations: [] };
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
    await render(MOCKS_TEST_TEMPLATE, targetFile, model);
    await vscode.window.showTextDocument(targetFile);
}
