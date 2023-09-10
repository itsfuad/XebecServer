import { XebecServer } from "../package/xebec.js";

const server = XebecServer();

server.get("/test", (req, res) => {
    //get cookies
    const cookies = req.headers.cookie;
    console.log(cookies);
    //set cookies
    res.setHeader("Set-Cookie", "name=John");
    res.send("Hello World!");
});

server.get("/test/:id", (req, res) => {
    res.send(`Hello ${req.params.id}!`);
});

server.listen(3000, () => {
    console.log("Server started on port 3000");
});