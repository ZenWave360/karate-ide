import * as $RefParser from '@apidevtools/json-schema-ref-parser';
import * as ejs from 'ejs';
import { buildKarateTestDataObject, buildKarateMockDataObject } from './test-data-generator';
import * as yml from 'js-yaml';
import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import * as merge from 'deepmerge';
const testTemplateFile = require('./templates/test.template.feature.ejs');
const mockTemplateFile = require('./templates/mock.template.feature.ejs');
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

async function parseOpenAPI(file) {
    try {
        const schema = await $RefParser.dereference(file);
        mergeAllOf(schema);
        mergePathParamsIntoOperations(schema);
        return schema;
    } catch (err) {
        console.error(err);
    }
}

function mergeAllOf(schema) {
    const seenObjects = [];

    function _mergeAllOf(obj) {
        if (seenObjects.includes(obj)) {
            return;
        }
        seenObjects.push(obj);
        if (obj && typeof obj === 'object') {
            for (let key of Object.keys(obj)) {
                if (key === 'allOf') {
                    // console.log('merging allOff', obj);
                    const allOf = merge.all(obj[key]);
                    delete allOf['original$ref'];
                    for (let key of Object.keys(allOf)) {
                        obj[key] = allOf[key];
                    }
                    delete obj['allOf'];
                    // console.log('merged', obj);
                    _mergeAllOf(obj);
                } else {
                    _mergeAllOf(obj[key]);
                }
            }
        }
    }
    _mergeAllOf(schema);
}

function mergePathParamsIntoOperations(schema) {
    Object.entries(schema.paths).forEach(([name, _path]) => {
        const path: any = _path;
        if (path.parameters) {
            Object.entries(path).forEach(([method, _operation]) => {
                if (method !== 'parameters' && method !== 'original$ref') {
                    // console.log(name, path.parameters, method, "\n---")
                    const operation: any = _operation;
                    operation.parameters = [...path.parameters, ...(operation.parameters || [])];
                }
            });
        }
    });
}

async function askForOperations(operations: { label: string; description: string; value: any }[]) {
    const selected = await vscode.window.showQuickPick(operations, { canPickMany: true });
    return selected.map(s => s.value);
}

async function promptTargetFolder(defaultFolder?: vscode.Uri) {
    return await vscode.window.showOpenDialog({
        canSelectMany: false,
        canSelectFolders: true,
        canSelectFiles: false,
        defaultUri: defaultFolder,
        openLabel: 'Select target folder',
    });
}

async function generateKarateTest(file, api, apisFolder: vscode.Uri, operations: any[]) {
    vscode.workspace.fs.createDirectory(apisFolder);
    operations.forEach(operation => {
        const model: any = { api, operationId: operation.operationId };
        model.operation = prepareData(operation);
        model.serviceName = serviceName(operation);
        const inlineRequest = buildKarateTestDataObject(model.operation, Object.keys(model?.operation?.responses)[0]);
        model.inlineRequest = JSON.stringify({ auth: null, ...inlineRequest }, null, 2);

        vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(apisFolder, model.serviceName));
        render(testTemplateFile, vscode.Uri.joinPath(apisFolder, model.serviceName, `${model.operationId}.feature`), model);

        Object.keys(model.operation.responses).forEach(statusCode => {
            if (statusCode !== '500') {
                try {
                    const testDataObject = buildKarateTestDataObject(model.operation, statusCode);
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
        });
    });

    // TODO choose wise where to put the auth file
    const resourcesRoot = await findResourcesFolder(file);
    const karateAuthFile = vscode.Uri.joinPath(resourcesRoot, 'karate-auth.js');
    if (!fs.existsSync(karateAuthFile.fsPath)) {
        fs.copyFileSync(path.join(__dirname, karateAuthTemplateFile), karateAuthFile.fsPath);
    }

    vscode.window.showInformationMessage(`Karate Test features generated in: ${vscode.workspace.asRelativePath(apisFolder, false)}`);
}

function generateKarateMocks(file: vscode.Uri, api, mocksFolder: vscode.Uri, operations: any[]) {
    vscode.workspace.fs.createDirectory(mocksFolder);

    Object.entries(operationsByTag(operations, api)).forEach(([tagName, operations]) => {
        const model: any = { api };
        model.operations = (operations as object[]).map(operation => prepareData(operation));
        model.apiName = normalize(tagName) + 'Mock';

        render(mockTemplateFile, vscode.Uri.joinPath(mocksFolder, model.apiName, `${model.apiName}.feature`), model);

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

function serviceName(operation) {
    return normalize(operation.tags && operation.tags[0]) + 'Api';
}

function normalize(tagName) {
    return (tagName || 'Default').split(' ').map(_.upperFirst).join('');
}

function operationsByTag(operations, api) {
    return operations.reduce((tags, operation) => {
        const tagName = operation.tags ? operation.tags[0] : 'Default';
        tags[tagName] = tags[tagName] || [];
        tags[tagName].push(prepareData(operation));
        return tags;
    }, {});
}

function getOperationsFor(api) {
    const httpVerbs = ['get', 'post', 'put', 'delete', 'patch'];
    return Object.entries(api.paths).reduce((allpaths, [path, value]) => {
        const operations = Object.keys(value)
            .filter(m => httpVerbs.includes(m))
            .reduce((allmethods, method) => {
                const operation = api.paths[path][method];
                if (operation.deprecated === true) {
                    return allmethods;
                }
                return allmethods.concat({
                    label: `${method.padEnd(4, ' ')}  ${path}    ${operation.operationId}`,
                    description: operation.description ? operation.description.substring(0, 80) : null,
                    value: { path, method, ...operation },
                });
            }, []);
        return allpaths.concat(operations);
    }, []);
}

function prepareData(operation) {
    const firstResponse: any = Object.values(operation.responses)[0];
    operation.statusCode = Object.keys(operation.responses)[0];
    operation.responseBody = firstResponse.content ? Object.values(firstResponse.content)[0] : null;
    operation.responseCode = Object.keys(operation.responses)[0];
    operation.operationName = _.upperFirst(operation.operationId);

    operation.pathParams = {};
    operation.queryParams = {};
    if (operation.parameters) {
        for (const param of _.orderBy(operation.parameters, ['required'], ['desc'])) {
            if (param.in === 'path') {
                operation.pathParams[param.name] = param;
            } else if (param.in === 'query') {
                operation.queryParams[param.name] = param;
            }
        }
    }

    return operation;
}

function render(template, target: vscode.Uri, model) {
    const options = {};
    try {
        ejs.renderFile(path.join(__dirname, template), model, options, function (err, output) {
            vscode.workspace.fs.writeFile(target, Buffer.from(output));
        });
    } catch (error) {
        console.log(error);
    }
}

async function findResourcesFolder(openapi: vscode.Uri) {
    const folder = await vscode.workspace.getWorkspaceFolder(openapi);
    const resourcesFolder = vscode.Uri.joinPath(folder.uri, 'src/test/resources');
    if (fs.existsSync(resourcesFolder.fsPath)) {
        return resourcesFolder;
    }
    return folder.uri;
}