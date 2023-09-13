import http from 'http';
import url from 'url';
import path from 'path';
import ejs from 'ejs';
import { getBoundary, parse } from './utils/formParser.js';
let __dirname;
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
    setViewsDirectory(dirname) {
        __dirname = dirname;
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
        res.render = this.render.bind(this, res);
        res.setCookie = this.setCookie.bind(this, res);
        res.clearCookie = this.clearCookie.bind(this, res);
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
    setCookie(res, name, value, options = {}) {
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
    clearCookie(res, name, options = {}) {
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
    send(res, body, statusCode = 200) {
        try {
            res.writeHead(statusCode);
            res.end(body);
        }
        catch (error) {
            console.error(error);
        }
    }
    render(res, view, data) {
        console.log('Rendering view:', view);
        //render the ejs file
        //read the file
        //use ejs to render the template
        ejs.renderFile(path.join(__dirname, 'views', view), data, (err, str) => {
            if (err) {
                console.error(err);
                res.writeHead(500);
                res.end('Internal Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(str);
        });
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
