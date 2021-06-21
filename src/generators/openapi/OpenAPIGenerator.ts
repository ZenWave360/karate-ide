import * as $RefParser from '@apidevtools/json-schema-ref-parser';
import * as ejs from 'ejs';
import * as fs from 'fs';
import { buildKarateTestDataObject, buildKarateMockDataObject } from './test-data-generator';
import * as yml from 'js-yaml';
import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as path from 'path';
import * as merge from 'deepmerge';
const testTemplateFile = require('./templates/test.template.feature.ejs');
const mockTemplateFile = require('./templates/mock.template.feature.ejs');
const karateAuthTemplateFile = require('./templates/karate-auth.js.ejs');

export async function generateKarateTestFromOpenAPI(file: vscode.Uri) {
    const api = await parseOpenAPI(file.fsPath);
    const operations = getOperationsFor(api);
    const selected = await askForOperations(operations);
    const apiname = path.basename(file.fsPath).replace(path.extname(file.fsPath), '');
    generateKarateTest(api, apiname, selected);
}

export async function generateKarateMocksFromOpenAPI(file: vscode.Uri) {
    const api = await parseOpenAPI(file.fsPath);
    const operations = getOperationsFor(api);
    const selected = await askForOperations(operations);
    const apiname = path.basename(file.fsPath).replace(path.extname(file.fsPath), '');
    generateKarateMocks(api, file, selected, file);
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

function generateKarateTest(api, apiname, operations: any[]) {
    let root = vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
    const apisFolder = path.join(root.uri.fsPath, 'src/test/resources/api/', apiname);
    fs.mkdirSync(path.join(apisFolder, 'test-data'), { recursive: true });
    operations.forEach(operation => {
        const model: any = { api, apiname, operationId: operation.operationId };
        model.operation = prepareData(operation);
        render(testTemplateFile, path.join(apisFolder, `${model.operationId}.feature`), model);

        Object.keys(model.operation.responses).forEach(statusCode => {
            if (statusCode !== '500') {
                try {
                    const testDataObject = buildKarateTestDataObject(model.operation, statusCode);
                    fs.writeFileSync(path.join(apisFolder, 'test-data', `${model.operationId}_${statusCode}.yml`), `${yml.dump(testDataObject)}`);
                } catch (error) {
                    fs.writeFileSync(path.join(apisFolder, 'test-data', `${model.operationId}_${statusCode}.yml`), error);
                }
            }
        });
    });

    const karateAuthFile = path.join(root.uri.fsPath, 'src/test/resources/karate-auth.js');
    if (!fs.existsSync(karateAuthFile)) {
        fs.copyFileSync(path.join(__dirname, karateAuthTemplateFile), karateAuthFile);
    }

    vscode.window.showInformationMessage(`Karate Test features generated in: ${apisFolder}`);
}

function generateKarateMocks(api, apiname, operations: any[], file: vscode.Uri) {
    let mocksFolder = path.join(path.dirname(file.fsPath), 'mocks');
    const apiPortalFile = path.join(path.dirname(file.fsPath), '..', 'api-portal.yml');
    if (fs.existsSync(apiPortalFile)) {
        const info = yml.load(fs.readFileSync(apiPortalFile).toString());
        if (info.vertical && info.api && info.api.name) {
            mocksFolder = path.join(mocksFolder, normalize(info.vertical).toLowerCase(), normalize(info.api.name).toLowerCase());
        }
    }

    Object.entries(operationsByTag(operations, api)).forEach(([tagName, operations]) => {
        const model: any = { api };
        model.operations = (operations as object[]).map(operation => prepareData(operation));
        model.tagName = normalize(tagName);
        model.apiName = `${_.upperFirst(model.tagName)}Mock`;
        model.mockFolder = path.join(mocksFolder, model.apiName);
        fs.mkdirSync(path.join(mocksFolder, model.apiName), { recursive: true });
        render(mockTemplateFile, path.join(mocksFolder, model.apiName, `${model.apiName}.feature`), model);

        (operations as any[]).forEach(operation => {
            const operationName = operation.operationId;
            Object.keys(operation.responses).forEach(statusCode => {
                if (statusCode !== '500') {
                    try {
                        const testDataObject = buildKarateMockDataObject(operation, statusCode);
                        fs.writeFileSync(path.join(mocksFolder, model.apiName, `${operationName}_${statusCode}.yml`), `${yml.dump(testDataObject)}`);
                    } catch (error) {
                        fs.writeFileSync(path.join(mocksFolder, model.apiName, `${operationName}_${statusCode}.yml`), error);
                    }
                }
            });
        });
    });

    vscode.window.showInformationMessage(`Karate Mock features generated in: ${mocksFolder}`);
}

function normalize(tagName) {
    return (tagName || 'Api').split(' ').map(_.upperFirst).join('');
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

function render(template, target, model) {
    const options = {};
    try {
        ejs.renderFile(path.join(__dirname, template), model, options, function (err, output) {
            fs.writeFileSync(target, err || output);
        });
    } catch (error) {
        console.log(error);
    }
}
