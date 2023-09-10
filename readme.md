# Xebec Server
### An Express.js alternative with minimal codebase

## Use
```js
import { Xebec } from 'xebec';

const app = new Xebec();

app.listen(3000, ()=>{
    console.log('Running...');
})
```