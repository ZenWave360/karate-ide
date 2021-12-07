export { buildKarateTestDataObject, buildExampleFromSchema, buildKarateMockDataObject };

/**
 *
 * @param {*} operation
 * @param {*} statusCode
 */
function buildKarateTestDataObject(operation: any, statusCode: string | number) {
    const params = buildParametersSample(operation.parameters);
    const requestSchema = () => (Object.values(operation.requestBody.content)[0] as any)?.schema;
    const hasResponseContent = operation.responses[statusCode].content && Object.keys(operation.responses[statusCode].content).length > 0;
    const responseSchema = () => {
        const schema = (Object.values(operation.responses[statusCode].content)[0] as any)?.schema;
        return isArraySchema(schema) ? schema.items : schema;
    };

    const body = operation.requestBody ? buildExampleFromSchema(requestSchema(), { optional: true }) : null;
    const responseMatch = hasResponseContent ? buildKarateSchema(responseSchema(), {}) : null;

    // schemas for nested arrays
    const responseMatchesEach = Object.entries(hasResponseContent ? responseSchema().properties || {} : {}).reduce((each, [property, schema]) => {
        if (isArraySchema(schema)) {
            each[property] = buildKarateSchema((schema as any).items, {});
        }
        return each;
    }, {});

    return {
        statusCode: +statusCode,
        headers: {},
        params,
        body,
        matchResponse: true,
        responseMatch,
        responseMatchesEach: responseMatchesEach,
    };
}

function buildKarateMockDataObject(operation, statusCode) {
    const hasResponseContent = operation.responses[statusCode].content;
    const responseSchema = () => (Object.values(operation.responses[statusCode].content)[0] as any).schema;
    const response = hasResponseContent ? buildExampleFromSchema(responseSchema(), { optional: true }) : null;
    return {
        responseStatus: +statusCode,
        request: {},
        requestMatch: {},
        response,
    };
}

export function buildParametersSample(parameters) {
    if (parameters) {
        return parameters.reduce((params, param) => {
            params[param.name] = buildExampleForProperty(param.schema, param.name);
            return params;
        }, {});
    }
    return null;
}

/**
 *
 * @param {*} schema
 * @param {*} options
 */
function buildExampleFromSchema(schema, options) {
    options.visited = options.visited || [];
    if (options.visited.includes(schema)) {
        return null;
    }
    options.visited.push(schema);
    if (schema.allOf) {
        return schema.allOf.reduce((allOfSchema, e) => Object.assign(allOfSchema, buildExampleFromSchema(e, options)), {});
    }
    if (schema.type === 'array') {
        return [buildExampleFromSchema(schema.items, options)];
    }
    if (schema.type === 'object') {
        const object = {};
        Object.entries(schema.properties || {}).forEach(([key, value]) => {
            if (!schema.required || schema.required.includes(key) || options.optional === true) {
                object[key] = buildExampleFromSchema(value, { ...options, name: key });
            }
        });
        return object;
    }
    return buildExampleForProperty(schema, options.name);
}

function buildExampleForProperty(schema, name) {
    if (schema.example !== undefined || schema.default !== undefined) {
        return schema.default !== undefined ? schema.default : schema.example;
    }
    let data: any = '';
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (name && name.toLowerCase().endsWith('id')) {
        data = 0;
    } else if (type === 'integer' || type === 'number') {
        if (name === 'limit') {
            data = 25;
        } else if (name === 'offset') {
            data = 0;
        } else {
            data = schema.minimum || -1;
        }
    } else if (type === 'boolean') {
        data = true;
    } else if (type === 'null') {
        data = null;
    } else if (type === 'string') {
        const format = schema.format;
        if (format === 'date') {
            data = new Date().toISOString().split('T')[0];
        } else if (format === 'time') {
            data = new Date().toISOString().split('T')[1];
        } else if (format === 'datetime') {
            // Write the date without milliseconds so Java can parse it
            // See https://stackoverflow.com/a/34053802/150868
            data = new Date().toISOString().split('.')[0];
        } else if (format === 'email') {
            data = 'fillsome@email';
        } else if (format === 'uri') {
            data = 'http://filsomevalue';
        } else if (format === 'uuid') {
            data = 'uuid';
        } else {
            if (schema.enum) {
                const index = Math.floor(Math.random() * Math.floor(schema.enum.length));
                data = schema.enum[index];
            } else {
                data = 'fill some value';
            }

            // Validation rules
            if (schema.pattern) {
                data = 'fill pattern: ' + schema.pattern;
            }
        }
    }
    return data;
}

function isArraySchema(schema) {
    const type = Array.isArray(schema?.type) ? schema.type[0] : schema?.type;
    return type === 'array';
}

/**
 *
 * @param {*} schema
 * @param {*} options
 */
function buildKarateSchema(schema, options) {
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    const required = options.requiredProps && options.requiredProps.includes(options.name);
    const nullable = schema.nullable === true || (Array.isArray(schema.type) && schema.type.includes("'null'"));
    const isOptionalPrefix = !required || nullable ? '#' : '';
    if (type === 'array') {
        return `${isOptionalPrefix}#array`;
        // return [buildKarateSchema(schema.items, { ...options, name: `${options.name}[*]` })];
    }
    if (type === 'object' && schema.properties) {
        const requiredProps = schema.required || [];
        const object = {};
        Object.entries(schema.properties).forEach(([key, value]) => {
            object[key] = buildKarateSchema(value, { ...options, name: key, requiredProps });
        });
        return object;
    }
    if (schema.type === 'integer') {
        return `${isOptionalPrefix}#number`;
    }
    if (schema.type === 'boolean') {
        return `${isOptionalPrefix}#boolean`;
    }
    return `${isOptionalPrefix}#string`;
}
