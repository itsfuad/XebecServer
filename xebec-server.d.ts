/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import http from 'http';
import { ParsedUrlQuery } from 'querystring';
interface HttpRequest extends http.IncomingMessage {
    params?: Record<string, string>;
    query?: ParsedUrlQuery;
    body?: Record<string, any>;
    files?: formFile[];
    method?: string;
    cookies?: Record<string, string>;
}
export interface HttpResponse extends http.ServerResponse {
    send: (body: any, statusCode?: number) => void;
    setCookie?: (name: string, value: string, options?: CookieOptions) => void;
    clearCookie?: (name: string, options?: CookieOptions) => void;
    status?: (statusCode: number) => void;
}
interface formFile {
    filename: string;
    type: string;
    data: Buffer;
    size: number;
}
interface CookieOptions {
    maxAge?: number;
    domain?: string;
    path?: string;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
}
declare class Xebec {
    private routes;
    private middleware;
    private server;
    private static instance;
    constructor();
    static getInstance(): Xebec;
    setViewsDirectory(dirname: string): void;
    get(path: string, ...handlers: ((req: HttpRequest, res: HttpResponse, next: () => {}) => void)[]): void;
    post(path: string, ...handlers: ((req: HttpRequest, res: HttpResponse, next: () => {}) => void)[]): void;
    use(middleware: (req: HttpRequest, res: HttpResponse, next: () => {}) => void): void;
    parseQueryString(queryString: string): Record<string, string>;
    registerRoute(method: string, path: string, handlers: ((req: HttpRequest, res: HttpResponse, next: () => {}) => void)[]): void;
    composeMiddleware(middlewares: ((req: HttpRequest, res: HttpResponse, next: any) => void)[], routeHandler: (req: HttpRequest, res: HttpResponse, next: any) => void): (req: HttpRequest, res: HttpResponse) => void;
    handleRequest(req: HttpRequest, res: HttpResponse): Promise<void>;
    status(res: HttpResponse, statusCode: number): HttpResponse;
    setCookie(res: HttpResponse, name: string, value: string, options?: CookieOptions): void;
    clearCookie(res: HttpResponse, name: string, options?: CookieOptions): void;
    send(res: HttpResponse, body: any, statusCode?: number): void;
    handleUnsupportedContentType(res: HttpResponse): void;
    handleNotFound(res: HttpResponse): void;
    getRouteRegex(routePath: string): RegExp;
    extractRouteParams(routePath: string, match: RegExpMatchArray): Record<string, string>;
    listen(port: number, callback: () => void): void;
}
export declare function XebecServer(): Xebec;
export declare function parseMutipartForm(req: HttpRequest, res: HttpResponse, next: () => void): void;
export declare function setMaxFileSize(size: number): void;
export {};
