import http from 'http';
import url from 'url';
import { getBoundary, parse } from './utils/formParser.js';
class Xebec {
    routes;
    middleware;
    server;
    static instance = null;
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
    static getInstance() {
        if (!Xebec.instance) {
            Xebec.instance = new Xebec();
        }
        return Xebec.instance;
    }
    get(path, ...handlers) {
        this.registerRoute('GET', path, handlers);
    }
    //post method
    post(path, ...handlers) {
        this.registerRoute('POST', path, handlers);
    }
    use(middleware) {
        this.middleware.push(middleware);
    }
    // Custom query string parsing method
    parseQueryString(queryString) {
        const params = {}; // Define the type for params
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
    registerRoute(method, path, handlers) {
        const middlewares = handlers.filter((handler) => typeof handler === 'function');
        const routeHandler = middlewares.pop() || (() => { });
        this.routes[method][path] = this.composeMiddleware([...this.middleware, ...middlewares], routeHandler);
    }
    composeMiddleware(middlewares, routeHandler) {
        return async (req, res) => {
            const executeMiddleware = async (index) => {
                if (index < middlewares.length) {
                    const middleware = middlewares[index];
                    await middleware(req, res, () => executeMiddleware(index + 1));
                }
                else {
                    // All middlewares have executed, call the route handler
                    routeHandler(req, res, () => { });
                }
            };
            // Execute the middleware stack for each incoming request
            executeMiddleware(0);
        };
    }
    async handleRequest(req, res) {
        const { pathname, query } = url.parse(req.url, true);
        const methodRoutes = this.routes[req.method];
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
    send(res, body, statusCode = 200) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    }
    handleUnsupportedContentType(res) {
        res.writeHead(415, { 'Content-Type': 'text/plain' });
        res.end('Unsupported Media Type');
    }
    handleNotFound(res) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
    getRouteRegex(routePath) {
        const pattern = routePath
            .replace(/:[^\s/]+/g, '([^/]+)')
            .replace(/\//g, '\\/');
        return new RegExp(`^${pattern}$`);
    }
    extractRouteParams(routePath, match) {
        const paramNames = routePath.match(/:[^\s/]+/g) || [];
        return paramNames.reduce((params, paramName, index) => {
            const key = paramName.substring(1);
            const value = match[index + 1];
            return { ...params, [key]: value };
        }, {});
    }
    listen(port, callback) {
        this.server.listen(port, callback);
    }
}
export function XebecServer() {
    return Xebec.getInstance();
}
export function parseMutipartForm(req, res, next) {
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
    const boundary = getBoundary(req.headers['content-type']);
    if (!boundary) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
        return;
    }
    //console.log('Boundary:', boundary);
    let chunks = [];
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
            }
            else {
                //console.log('Field:', part);
                req.body = req.body || {};
                part.name && (req.body[part.name] = part.data.toString());
            }
        });
        next();
    });
}
let maxFileSize = 1024 * 1024 * 100; //100MB
export function setMaxFileSize(size) {
    maxFileSize = size;
}
