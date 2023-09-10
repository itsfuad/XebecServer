import http from 'http';
import url from 'url';
import { getBoundary, parse } from './utils/formParser.js';
class Xebec {
    routes;
    middleware;
    server;
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
function parseMutipartForm(req, res, next) {
    //console.log('Parsing multipart form data');
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
export let maxFileSize = 1024 * 1024 * 100; //100MB
