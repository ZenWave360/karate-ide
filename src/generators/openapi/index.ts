import * as $RefParser from '@apidevtools/json-schema-ref-parser';
import * as ejs from 'ejs';
import * as fs from 'fs';
import { buildKarateTestDataObject } from './test-data-generator';
import * as yml from 'js-yaml';
import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as path from 'path';

export async function generateKarateTestFromOpenAPI(file: vscode.Uri) {
    const api = await parseOpenAPI(file.fsPath);
    const operations = getOperationsFor(api);
    const selected = await askForOperations(operations);
    const apiname = path.basename(file.fsPath).replace(path.extname(file.fsPath), '');
    generateKarateTest(api, apiname, selected);
}

async function parseOpenAPI(file) {
    try {
        return await $RefParser.dereference(file);
    } catch (err) {
        console.error(err);
    }
}

async function askForOperations(operations: { label: string; description: string; value: any }[]) {
    const selected = await vscode.window.showQuickPick(operations, { canPickMany: true });
    return selected.map(s => s.value);
}

function generateKarateTest(api, apiname, operations: any[]) {
    let root = vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
    const apiTargetFolder = path.join(root.uri.fsPath, 'src/test/resources/api/', apiname);
    fs.mkdirSync(path.join(apiTargetFolder, 'test-data'), { recursive: true });
    operations.forEach(operation => {
        const model: any = { api, apiname, operationId: operation.operationId };
        model.operation = prepareData(operation);
        template('../../../src/generators/openapi/template.feature.ejs', path.join(apiTargetFolder, `${model.operationId}.feature`), model);

        Object.keys(model.operation.responses).forEach(statusCode => {
            if (statusCode !== '500') {
                try {
                    const testDataObject = buildKarateTestDataObject(model.operation, statusCode);
                    fs.writeFileSync(
                        path.join(apiTargetFolder, 'test-data', `${model.operationId}_${statusCode}.yml`),
                        `${yml.safeDump(testDataObject)}`
                    );
                } catch (error) {
                    fs.writeFileSync(path.join(apiTargetFolder, 'test-data', `${model.operationId}_${statusCode}.yml`), error);
                }
            }
        });
    });
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

function template(source, target, model) {
    const options = {};
    try {
        ejs.renderFile(path.join(__dirname, source), model, options, function (err, output) {
            fs.writeFileSync(target, err || output);
        });
    } catch (error) {
        console.log(error);
    }
}
