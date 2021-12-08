import * as path from 'path';
import { parseFeature } from '@/feature';
import { filesManager } from '@/fs/FilesManager';
import * as vscode from 'vscode';
import { parseOpenAPI } from '../json-schema-ref-parser';
import { findOperationById, render } from './OpenAPIGeneratorUtils';
import { buildKarateTestDataObject } from './test-data-generator';
import { promptToSaveFeature } from './OpenAPIGenerator';
const FLOW_TEST_TEMPLATE = require('./templates/flow-test.feature.ejs');

export async function generateBusinessFlowTest(unused: vscode.Uri, features: vscode.Uri[]) {
    if (features.length < 2) {
        vscode.window.showErrorMessage('You need to select more than one feature file in order to generate a business flow test');
        return;
    }
    const unsupportedFeatures = [];
    const apis = {};
    const model = { testName: '', openapiFiles: [], operationIds: [], operations: [] };
    for (const file of features) {
        const feature = await parseFeature(file);
        const openapiFile = feature.tags.find(tag => tag.startsWith('@openapi-file=')).replace('@openapi-file=', '');
        const operationId = feature.scenarios
            .find(scenario => scenario.tags.includes('@operation'))
            ?.tags?.find(tag => tag.startsWith('@operationId='))
            .replace('@operationId=', '');
        if (openapiFile && operationId) {
            const oasPaths = await vscode.workspace.findFiles(openapiFile); // check if file exists and not multiple files are found
            const api = apis[openapiFile] || (apis[openapiFile] = await parseOpenAPI(oasPaths[0].fsPath));
            const operation = findOperationById(api, operationId);
            const { params, body, statusCode } = buildKarateTestDataObject(operation, Object.keys(operation?.responses)[0]);
            model.openapiFiles.push(openapiFile);
            model.operationIds.push(operationId);
            model.operations.push({
                feature: 'classpath:' + filesManager.getClasspathRelativePath(file),
                openapiFile,
                operationId,
                params,
                body,
                statusCode,
                operation,
            });
        } else {
            unsupportedFeatures.push(file);
        }
    }
    if (model.operations?.length > 0) {
        const targetFile = await promptToSaveFeature('Save Business Flow Test');
        if (targetFile) {
            model.testName = filesManager
                .getClasspathRelativePath(targetFile)
                .replace(/\/|(.feature)/g, ' ')
                .trim();
            model.openapiFiles = [...new Set(model.openapiFiles)];
            await render(FLOW_TEST_TEMPLATE, targetFile, model);
            await vscode.window.showTextDocument(targetFile);
        }
    }
    if (unsupportedFeatures.length > 0) {
        vscode.window.showErrorMessage(`Not supported feature/s: ${unsupportedFeatures.map(f => path.basename(f.fsPath) + '.feature').join(', ')}`);
    }
}
