import * as $RefParser from '@apidevtools/json-schema-ref-parser';
import * as merge from 'deepmerge';
const _dereference = require('./_dereference');

$RefParser.prototype.dereference = _dereference;

export async function parseOpenAPI(file) {
    try {
        const schema = await new $RefParser().dereference(file);
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


export default $RefParser;
