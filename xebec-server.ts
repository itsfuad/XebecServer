import http from 'http';
import url from 'url';
import { ParsedUrlQuery } from 'querystring';
import { getBoundary, parse } from '@itsfuad/multipart-form-reader';


let __dirname: string;

// Define a custom request type/interface
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

class Xebec {
    private routes: any;
    private middleware: any;
    public server: http.Server;
    private static instance: Xebec | null = null;
    constructor() {
        this.routes = {
            GET: {},
            POST: {},
        };
        this.middleware = [];
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res as HttpResponse);
        });
    }

    static getInstance(): Xebec {
        if (!Xebec.instance) {
            Xebec.instance = new Xebec();
        }
        return Xebec.instance;
    }

    setViewsDirectory(dirname: string) {
        __dirname = dirname;
    }

    get(path: string, ...handlers: ((req: HttpRequest, res: HttpResponse, next: ()=>{}) => void)[]) {
        //console.log('GET', path);
        this.registerRoute('GET', path, handlers);
    }

    //post method
    post(path: string, ...handlers: ((req: HttpRequest, res: HttpResponse, next: ()=>{}) => void)[]) {
        //console.log('POST', path);
        this.registerRoute('POST', path, handlers);
    }

    use(middleware: (req: HttpRequest, res: HttpResponse, next: ()=>{}) => void) {
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
    

    registerRoute(method: string, path: string, handlers: ((req: HttpRequest, res: HttpResponse, next: ()=>{}) => void)[]) {
        const middlewares = handlers.filter((handler) => typeof handler === 'function');
        const routeHandler = middlewares.pop() || (() => { });
    
        this.routes[method][path] = this.composeMiddleware([...this.middleware, ...middlewares], routeHandler);
    }
    

    composeMiddleware(
        middlewares: ((req: HttpRequest, res: HttpResponse, next: any) => void)[],
        routeHandler: (req: HttpRequest, res: HttpResponse, next: any) => void,
    ): (req: HttpRequest, res: HttpResponse) => void {
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

        //console.log('Request:', req.method, req.url);

        res.send = this.send.bind(this, res);

        res.setCookie = this.setCookie.bind(this, res);
        res.clearCookie = this.clearCookie.bind(this, res);

        res.status = this.status.bind(this, res);

        req.cookies = this.parseQueryString(req.headers.cookie || '');
    
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


    status(res: HttpResponse, statusCode: number) {
        res.statusCode = statusCode;
        console.log('Status:', statusCode);
        return res;
    }

    
    setCookie(res: HttpResponse, name: string, value: string, options: CookieOptions = {}) {
        let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        
        if (options.maxAge) {
            cookie += `; Max-Age=${options.maxAge}`;
        }
        if (options.domain) {
            cookie += `; Domain=${options.domain}`;
        }
        if (options.path) {
            cookie += `; Path=${options.path}`;
        }
        if (options.expires) {
            cookie += `; Expires=${options.expires.toUTCString()}`;
        }
        if (options.httpOnly) {
            cookie += `; HttpOnly`;
        }
        if (options.secure) {
            cookie += `; Secure`;
        }
        res.setHeader('Set-Cookie', cookie);
    }

    clearCookie(res: HttpResponse, name: string, options: CookieOptions = {}) {
        let cookie = `${encodeURIComponent(name)}=; Max-Age=0`;
        if (options.domain) {
            cookie += `; Domain=${options.domain}`;
        }
        if (options.path) {
            cookie += `; Path=${options.path}`;
        }
        if (options.expires) {
            cookie += `; Expires=${options.expires.toUTCString()}`;
        }
        if (options.httpOnly) {
            cookie += `; HttpOnly`;
        }
        if (options.secure) {
            cookie += `; Secure`;
        }
        res.setHeader('Set-Cookie', cookie);
    }
    

    send(res: HttpResponse, body: any, statusCode = 200) {
        try {
            res.writeHead(res.statusCode);
            res.end(body);
        } catch (error) {
            console.error(error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }

    handleUnsupportedContentType(res: HttpResponse) {
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

export function parseMutipartForm(req: HttpRequest, res: HttpResponse, next: () => void) {
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