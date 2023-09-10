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
    

    async handleRequest(req: HttpRequest, res: http.ServerResponse) {
        const { pathname, query } = url.parse(req.url as string, true);
        const methodRoutes = this.routes[req.method as string];
    
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


    handleUnsupportedContentType(res: http.ServerResponse) {
        res.writeHead(415, { 'Content-Type': 'text/plain' });
        res.end('Unsupported Media Type');
    }

    handleNotFound(res: http.ServerResponse) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }

    getRouteRegex(routePath: string) {
        const pattern = routePath
            .replace(/:[^\s/]+/g, '([^/]+)')
            .replace(/\//g, '\\/');
        return new RegExp(`^${pattern}$`);
    }

    extractRouteParams(routePath: string, match: RegExpMatchArray) {
        const paramNames = routePath.match(/:[^\s/]+/g) || [];
        return paramNames.reduce((params, paramName, index) => {
            const key = paramName.substring(1);
            const value = match[index + 1];
            return { ...params, [key]: value };
        }, {});
    }

    listen(port: number, callback: () => void) {
        this.server.listen(port, callback);
    }
}


function parseMutipartForm(req: HttpRequest, res: http.ServerResponse, next: () => void) {
    //console.log('Parsing multipart form data');

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

export let maxFileSize = 1024 * 1024 * 100; //100MB
