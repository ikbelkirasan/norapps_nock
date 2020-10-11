"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("url");
const nock_1 = __importDefault(require("nock"));
const lodash_1 = __importDefault(require("lodash"));
const jest_diff_1 = __importDefault(require("jest-diff"));
const colors_1 = __importDefault(require("colors"));
const extract_json_from_string_1 = __importDefault(require("extract-json-from-string"));
function getUnmatchedPayload(error) {
    let payload;
    try {
        payload = lodash_1.default.first(extract_json_from_string_1.default(error.message));
        // Extract url
        const url = new url_1.URL(payload.url);
        payload.url = `${url.origin}${url.pathname}`;
        // Get query string params
        const query = {};
        for (const [key, value] of url.searchParams.entries()) {
            query[key] = value;
        }
        payload.query = query;
        // Extract body
        if (payload.body) {
            try {
                payload.body = JSON.parse(payload.body);
            }
            catch (error) { }
        }
        // Extract headers
        if (payload.headers) {
            payload.headers = lodash_1.default.mapValues(payload.headers, (value, key) => {
                if (lodash_1.default.isArray(value)) {
                    return lodash_1.default.first(value);
                }
                return value;
            });
        }
    }
    catch (error) {
        throw new Error("Could not parse payload from error message: " + error.message);
    }
    return payload;
}
const scopes = [];
//@ts-ignore
const mock = function (basePath, options) {
    const scope = nock_1.default(basePath, options);
    scopes.push(scope);
    return scope;
};
Object.setPrototypeOf(mock, nock_1.default);
// Get all recorded scopes
function getInterceptors() {
    const result = {};
    for (const scope of scopes) {
        const { keyedInterceptors } = scope;
        for (let key in keyedInterceptors) {
            result[key] = result[key] || [];
            const interceptors = keyedInterceptors[key];
            result[key].push(...interceptors);
        }
    }
    return result;
}
// Get all recorded scopes
function getActiveInterceptors() {
    const allInterceptors = getInterceptors();
    return lodash_1.default.pick(allInterceptors, nock_1.default.activeMocks());
}
function getInterceptorInfo(interceptor) {
    const url = new url_1.URL(interceptor.basePath);
    const headers = {};
    for (const h of interceptor.interceptorMatchHeaders) {
        headers[h.name] = h.value;
    }
    const body = interceptor._requestBody;
    const query = interceptor.queries;
    url.pathname = interceptor.uri;
    return {
        method: interceptor.method,
        url: url.toString(),
        query,
        headers,
        body,
    };
}
async function runInContext(cb) {
    try {
        await cb();
    }
    catch (error) {
        if (error.code === "ERR_NOCK_NO_MATCH") {
            try {
                const interceptors = getActiveInterceptors();
                const payload = getUnmatchedPayload(error);
                for (const interceptor of lodash_1.default.flatten(lodash_1.default.values(interceptors))) {
                    const expected = getInterceptorInfo(interceptor);
                    const expectedHeaders = lodash_1.default.map(interceptor.interceptorMatchHeaders, (h) => {
                        return lodash_1.default.toLower(h["name"]);
                    });
                    const received = lodash_1.default.cloneDeep(payload);
                    received.headers = lodash_1.default.pick(received.headers, expectedHeaders);
                    expected.headers = lodash_1.default.mapKeys(expected.headers, (value, key) => lodash_1.default.toLower(key));
                    const info = [];
                    // print method + url
                    info.push(colors_1.default.yellow.bold("URL: ") +
                        colors_1.default.magenta(expected.method) +
                        " " +
                        expected.url);
                    // print query
                    info.push(colors_1.default.yellow.bold("Query:\n") +
                        jest_diff_1.default(expected.query, received.query, {
                            omitAnnotationLines: true,
                        }));
                    // Compare headers
                    info.push(colors_1.default.yellow.bold("Headers:\n") +
                        jest_diff_1.default(expected.headers, received.headers, {
                            omitAnnotationLines: true,
                        }));
                    // Compare bodies
                    info.push(colors_1.default.yellow.bold("Body:\n") +
                        jest_diff_1.default(expected.body, received.body, {
                            omitAnnotationLines: true,
                        }));
                    // print results
                    console.log(colors_1.default.bgYellow.black(`🦉 Possible match \r\n\n\b`), info.join("\n"));
                }
            }
            catch (error2) {
                console.warn(error2);
                throw error;
            }
            throw new Error("No match for request");
        }
        else {
            throw error;
        }
    }
}
mock.scopes = scopes;
mock.getInterceptors = getInterceptors;
mock.getActiveInterceptors = getActiveInterceptors;
mock.runInContext = runInContext;
exports.default = mock;
//# sourceMappingURL=index.js.map