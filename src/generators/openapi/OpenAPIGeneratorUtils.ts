import * as ejs from 'ejs';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';
import * as pluralize from 'pluralize';
import { getFileAndRootPath } from '@/helper';

export function normalizeTag(tagName) {
    return (tagName || 'Default').split(' ').map(_.upperFirst).join('');
}

export function serviceName(operation) {
    return normalizeTag(operation.tags && operation.tags[0]) + 'Api';
}

export function operationsByTag(operations, api) {
    return operations.reduce((tags, operation) => {
        const tagName = operation.tags ? operation.tags[0] : 'Default';
        tags[tagName] = tags[tagName] || [];
        tags[tagName].push(prepareData(operation));
        return tags;
    }, {});
}

export function findOperationById(api, operationId) {
    const paths = Object.values(api.paths);
    for (const path of paths) {
        const operations = Object.values(path);
        for (const operation of operations) {
            if (operation.operationId === operationId) {
                return operation;
            }
        }
    }
    return null;
}

export function getOperationsFor(api) {
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

export function prepareData(operation) {
    const firstResponse: any = Object.values(operation.responses)[0];
    operation.statusCode = Object.keys(operation.responses)[0];
    operation.responseBody = firstResponse.content ? Object.values(firstResponse.content)[0] : null;
    operation.responseCode = Object.keys(operation.responses)[0];
    operation.operationName = _.upperFirst(operation.operationId);
    operation.parameters = operation.parameters || [];
    operation.responseSchema = operation.responseBody ? operation.responseBody.schema : null;
    operation.responseDtoName = operation.responseBody ? getDtoName(operation.responseBody.schema) : null;
    operation.responseDtoNamePlural = operation.responseDtoName ? pluralize(operation.responseDtoName) : null;
    operation.responseIsObject = operation.responseBody ? operation.responseBody.schema.type === 'object' : false;
    operation.responseIsArray = operation.responseBody ? isArray(operation.responseBody.schema) : false;
    operation.responseIsPrimitive = operation.responseBody ? !operation.responseBody || operation.responseBody.schema.type === 'string' : false;
    operation.responseIsPaginated = isPagination(operation.responseSchema);

    operation.pathParams = {};
    operation.queryParams = {};

    for (const param of _.orderBy(operation.parameters, ['required'], ['desc'])) {
        if (param.in === 'path') {
            operation.pathParams[param.name] = param;
        } else if (param.in === 'query') {
            operation.queryParams[param.name] = param;
        }
    }

    return operation;
}

function isPagination(schema) {
    if (!schema || schema.type !== 'object') {
        return false;
    }
    if (schema.hasOwnProperty('x-paginated')) {
        return schema['x-paginated'];
    }
    const properties = Object.values(schema.properties || {});
    if (
        properties.length === 3 &&
        properties.filter((p: any) => p.type === 'integer').length === 2 &&
        properties.filter((p: any) => p.type === 'array').length === 1
    ) {
        return true;
    }
    return false;
}

function isArray(schema) {
    return schema && schema.type === 'array';
}

export function getDtoName(schema) {
    if (isPagination(schema)) {
        return getDtoName(schema.properties.find(p => p.type === 'array').items);
    }
    if (isArray(schema)) {
        return getDtoName(schema.items);
    }
    return _.lowerFirst(schema?.original$ref?.split('/').pop());
}

export function padCellsForTabularData(headers: string[], examplesByStatus: { [index: string]: { paramExamples: string[] } }) {
    const maxLengths = headers.map(header => header.length);
    const data: string[][] =
        Object.values(examplesByStatus)
            .filter(i => Array.isArray(i))
            .map(example => example.paramExamples) || [];
    data.forEach(row => {
        row.forEach((cell, i) => {
            maxLengths[i] = Math.max(maxLengths[i], (cell + '').length);
        });
    });

    for (let i = 0; i < headers.length; i++) {
        headers[i] = headers[i].padEnd(maxLengths[i], ' ');
    }

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        for (let i = 0; i < row.length; i++) {
            row[i] = (row[i] + '').padEnd(maxLengths[i], ' ');
        }
    }
}

export function render(template, target: vscode.Uri, model): Promise<void> {
    return new Promise((resolve, reject) => {
        const options = {};
        try {
            ejs.renderFile(path.join(__dirname, template), model, options, async function (err, output) {
                await vscode.workspace.fs.writeFile(target, Buffer.from((err && err.message) || output));
                resolve();
            });
        } catch (error) {
            console.error(error.message);
            reject(error);
        }
    });
}

export async function findResourcesFolder(file: vscode.Uri) {
    const rootPath = getFileAndRootPath(file).root;
    const folder = vscode.Uri.file(rootPath);
    const resourcesFolder = vscode.Uri.joinPath(folder, 'src/test/resources');
    if (fs.existsSync(resourcesFolder.fsPath)) {
        return resourcesFolder;
    }
    return folder;
}
