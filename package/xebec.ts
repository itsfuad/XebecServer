import http from 'http';
import url from 'url';
import { ParsedUrlQuery } from 'querystring';
import { getBoundary, parse } from './utils/formParser.js';

// Define a custom request type/interface
interface HttpRequest extends http.IncomingMessage {
    params?: Record<string, string>;
    query?: ParsedUrlQuery;
    body?: Record<string, any>;
    files?: formFile[];
    method?: string;
    cookies?: Record<string, string>;
}

interface HttpResponse extends http.ServerResponse {
    send?: (body: any, statusCode?: number) => void;
    status?: (code: number) => { send: (body: any) => void };
}

interface formFile {
    filename: string;
    type: string;
    data: Buffer;
    size: number;
}

class Xebec {
    private routes: any;
    private middleware: any;
    private server: http.Server;
    private static instance: Xebec | null = null;
    constructor() {
        this.routes = {
            GET: {},
            POST: {},
        };
        this.middleware = [];
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });
    }

    static getInstance(): Xebec {
        if (!Xebec.instance) {
            Xebec.instance = new Xebec();
        }
        return Xebec.instance;
    }

    get(path: string, ...handlers: ((req: HttpRequest, res: http.ServerResponse, next: ()=>{}) => void)[]) {
        this.registerRoute('GET', path, handlers);
    }

    //post method
    post(path: string, ...handlers: ((req: HttpRequest, res: http.ServerResponse, next: ()=>{}) => void)[]) {
        this.registerRoute('POST', path, handlers);
    }

    use(middleware: (req: HttpRequest, res: http.ServerResponse, next: ()=>{}) => void) {
        this.middleware.push(middleware);
    }

    // Custom query string parsing method
    parseQueryString(queryString: string): Record<string, string> {
        const params: Record<string, string> = {}; // Define the type for params
    
        if (queryString) {
            const keyValues = queryString.split('&');
    
            for (const keyValue of keyValues) {
                const [key, value] = keyValue.split('=');
                if (key && value !== undefined) {
                    params[decodeURIComponent(key)] = decodeURIComponent(value);
                }
            }
        }
    
        return params;
    }
    

    registerRoute(method: string, path: string, handlers: ((req: HttpRequest, res: http.ServerResponse, next: ()=>{}) => void)[]) {
        const middlewares = handlers.filter((handler) => typeof handler === 'function');
        const routeHandler = middlewares.pop() || (() => { });
    
        this.routes[method][path] = this.composeMiddleware([...this.middleware, ...middlewares], routeHandler);
    }
    

    composeMiddleware(
        middlewares: ((req: HttpRequest, res: http.ServerResponse, next: any) => void)[],
        routeHandler: (req: HttpRequest, res: http.ServerResponse, next: any) => void,
    ): (req: HttpRequest, res: http.ServerResponse) => void {
        return async (req, res) => {
            const executeMiddleware = async (index: number) => {
                if (index < middlewares.length) {
                    const middleware = middlewares[index];
                    await middleware(req, res, () => executeMiddleware(index + 1));
                } else {
                    // All middlewares have executed, call the route handler
                    routeHandler(req, res, () => { });
                }
            };
    
            // Execute the middleware stack for each incoming request
            executeMiddleware(0);
        };
    }
    

    async handleRequest(req: HttpRequest, res: HttpResponse) {
        const { pathname, query } = url.parse(req.url as string, true);
        const methodRoutes = this.routes[req.method as string];

        if (!methodRoutes) {
            this.handleNotFound(res);
            return;
        }

        res.send = this.send.bind(this, res);
    
        for (const routePath in methodRoutes) {
            const routeHandler = methodRoutes[routePath];
            const regexPattern = this.getRouteRegex(routePath);
            
            const match = pathname?.match(regexPattern);
    
            if (match) {
                req.query = query;
                req.params = this.extractRouteParams(routePath, match);
                routeHandler(req, res);
                return; // Stop searching for routes
            }
        }
    }

    send(res: http.ServerResponse, body: any, statusCode = 200) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    }


    handleUnsupportedContentType(res: http.ServerResponse) {
        res.writeHead(415, { 'Content-Type': 'text/plain' });
        res.end('Unsupported Media Type');
    }

    handleNotFound(res: HttpResponse) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }

    getRouteRegex(routePath: string) {
        const pattern = routePath
            .replace(/:[^\s/]+/g, '([^/]+)')
            .replace(/\//g, '\\/');
        return new RegExp(`^${pattern}$`);
    }

    extractRouteParams(routePath: string, match: RegExpMatchArray): Record<string, string> {
        const paramNames = routePath.match(/:[^\s/]+/g) || [] as string[];
        return paramNames.reduce((params: Record<string, string>, paramName: string, index: number) => {
            const key = paramName.substring(1);
            const value = match[index + 1];
            return { ...params, [key]: value };
        }, {} as Record<string, string>);
    }
    
    

    listen(port: number, callback: () => void) {
        this.server.listen(port, callback);
    }
}

export function XebecServer(): Xebec{
    return Xebec.getInstance();
}

export function parseMutipartForm(req: HttpRequest, res: http.ServerResponse, next: () => void) {
    //console.log('Parsing multipart form data');

    if (!req.headers['content-type'] || !req.headers['content-type'].startsWith('multipart/form-data')) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
        return;
    }

    if (req.headers['content-length'] && Number(req.headers['content-length']) > maxFileSize) {
        res.writeHead(413, { 'Content-Type': 'text/plain' });
        res.end('Request Entity Too Large');
        return;
    }

    const boundary = getBoundary(req.headers['content-type'] as string);
    
    if (!boundary) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
        return;
    }
    
    //console.log('Boundary:', boundary);

    let chunks: Buffer[] = [];

    req.on('data', (chunk) => {
        chunks.push(chunk);
    });

    req.on('end', () => {
        const body = Buffer.concat(chunks);
        const formData = parse(body, boundary);
        //console.log('Parts:', formData);
        formData.forEach((part) => {
            if (part['filename']) {
                //console.log('File:', part);
                req.files = req.files || [];
                req.files.push({
                    filename: part.filename,
                    type: part.type,
                    data: part.data,
                    size: part.data.length,
                });
            } else {
                //console.log('Field:', part);
                req.body = req.body || {};
                part.name && (req.body[part.name] = part.data.toString());
            }
        });
        next();
    });
}

let maxFileSize = 1024 * 1024 * 100; //100MB

export function setMaxFileSize(size: number) {
    maxFileSize = size;
}