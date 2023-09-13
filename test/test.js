import { XebecServer } from "./../xebec-server.js";

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
    res.send("Default route");
});

server.get("/test", (req, res) => {
    //get cookies
    const cookies = req.headers.cookie;
    console.log(cookies);
    //set cookies
    res.setCookie('name', 'Fuad', { httpOnly: true, maxAge: 3600 });
    //res.clearCookie('name');
    res.send("Hello World!");
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