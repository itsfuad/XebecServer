# Xebec Server
### An Express.js alternative with minimal codebase
Use it when you need a small server. This codebase is way more smaller than express.js itself.

## Use
```js
import { XebecServer } from "xebec-server";
import { setMaxFileSize, readForm } from "multipart-form-reader";

const server = XebecServer();

const __dirname = process.cwd();
console.log(__dirname);
server.setViewsDirectory(__dirname + "/test");

// Example data
const data = {
    Name: 'Fuad',
    Items: ['Item 1', 'Item 2', 'Item 3'],
    condition: true // Change this condition as needed
};

server.get("/", (req, res) => {
    console.log('Request received: /');
    res.statusCode = 404;
    res.status(200).send("Hello World!");
});

server.get("/test", (req, res) => {
    //get cookies
    console.log('Request received: /test');
    const cookies = req.headers.cookie;
    console.log(cookies);
    //set cookies
    res.setCookie('name', 'Fuad', { httpOnly: true, maxAge: 3600 });
    //res.clearCookie('name');
    res.send("Hello World!");
});

setMaxFileSize(1000000); // 1MB

server.post('/upload', readForm, (req, res) => {

    console.log('Request received: /upload');

    console.log(req.body);
    /*
     Should output:
        {
        fields: { age: '22' },
        files: [
                {
                filename: '373339577_265286506327738_9175574451157144857_n.jpg',
                type: 'image/jpeg',
                name: 'File',
                data: <Buffer ff d8 ff e0 00 10 4a 46 49 46 00 01 01 ... 50461 more bytes>   
                }
            ]
        }
     */

    res.send('Upload received');
});

server.get("/test/:id", (req, res) => {
    res.send(`Hello ${req.params.id}!`);
});

server.get('/views', (req, res) => {
    res.render('test.ejs', data);
});

server.get('/testArray', (req, res) => {
    res.send(JSON.stringify(testArray));
});

server.listen(3000, () => {
    console.log("Server started on port 3000");
});
```