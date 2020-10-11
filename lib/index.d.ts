import nock from "nock";
declare type InterceptorMap = {
    [key: string]: nock.Interceptor[];
};
declare type Mock = typeof nock & {
    scopes: nock.Scope[];
    getInterceptors: () => InterceptorMap;
    getActiveInterceptors: () => InterceptorMap;
    runInContext: (cb: () => any) => Promise<void>;
};
declare const mock: Mock;
export default mock;
