import { Url, URL } from "url";
import nock from "nock";
import _ from "lodash";
import diff from "jest-diff";
import colors from "colors";
import extract from "extract-json-from-string";

type InterceptorMap = { [key: string]: nock.Interceptor[] };

type Mock = typeof nock & {
  scopes: nock.Scope[];
  getInterceptors: () => InterceptorMap;
  getActiveInterceptors: () => InterceptorMap;
  runInContext: (cb: () => any) => Promise<void>;
};

function getUnmatchedPayload(error: Error) {
  let payload: any;
  try {
    payload = _.first(extract(error.message));

    // Extract url
    const url = new URL(payload.url);
    payload.url = `${url.origin}${url.pathname}`;

    // Get query string params
    const query: { [key: string]: string | null } = {};
    for (const [key, value] of url.searchParams.entries()) {
      query[key] = value;
    }
    payload.query = query;

    // Extract body
    if (payload.body) {
      try {
        payload.body = JSON.parse(payload.body);
      } catch (error) {}
    }

    // Extract headers
    if (payload.headers) {
      payload.headers = _.mapValues(payload.headers, (value, key) => {
        if (_.isArray(value)) {
          return _.first(value);
        }
        return value;
      });
    }
  } catch (error) {
    throw new Error(
      "Could not parse payload from error message: " + error.message
    );
  }

  return payload;
}

const scopes: nock.Scope[] = [];

//@ts-ignore
const mock: Mock = function (
  basePath: string | RegExp | Url,
  options?: nock.Options
) {
  const scope = nock(basePath, options);
  scopes.push(scope);
  return scope;
};
Object.setPrototypeOf(mock, nock);

// Get all recorded scopes
function getInterceptors() {
  const result: InterceptorMap = {};
  for (const scope of scopes) {
    const { keyedInterceptors } = scope as any;
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
  return _.pick(allInterceptors, nock.activeMocks());
}

function getInterceptorInfo(interceptor: any) {
  const url = new URL(interceptor.basePath);
  const headers: { [key: string]: string } = {};
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

async function runInContext(cb: () => any) {
  try {
    await cb();
  } catch (error) {
    if (error.code === "ERR_NOCK_NO_MATCH") {
      try {
        const interceptors = getActiveInterceptors();
        const payload = getUnmatchedPayload(error);

        for (const interceptor of _.flatten(_.values(interceptors))) {
          const expected = getInterceptorInfo(interceptor);
          const expectedHeaders: string[] = _.map(
            (interceptor as any).interceptorMatchHeaders,
            (h) => {
              return _.toLower(h["name"]);
            }
          );

          const received = _.cloneDeep(payload);
          received.headers = _.pick(received.headers, expectedHeaders);
          expected.headers = _.mapKeys(expected.headers, (value, key) =>
            _.toLower(key)
          );

          const info = [];

          // print method + url
          info.push(
            colors.yellow.bold("URL: ") +
              colors.magenta(expected.method) +
              " " +
              expected.url
          );

          // print query
          info.push(
            colors.yellow.bold("Query:\n") +
              diff(expected.query, received.query, {
                omitAnnotationLines: true,
              })
          );

          // Compare headers
          info.push(
            colors.yellow.bold("Headers:\n") +
              diff(expected.headers, received.headers, {
                omitAnnotationLines: true,
              })
          );

          // Compare bodies
          info.push(
            colors.yellow.bold("Body:\n") +
              diff(expected.body, received.body, {
                omitAnnotationLines: true,
              })
          );

          // print results
          console.log(
            colors.bgYellow.black(`🦉 Possible match \r\n\n\b`),
            info.join("\n")
          );
        }
      } catch (error2) {
        console.warn(error2);
        throw error;
      }
      throw new Error("No match for request");
    } else {
      throw error;
    }
  }
}

mock.scopes = scopes;
mock.getInterceptors = getInterceptors;
mock.getActiveInterceptors = getActiveInterceptors;
mock.runInContext = runInContext;

export default mock;
