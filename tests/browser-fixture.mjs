import { createServer } from 'node:http';
createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
  });
  res.end(
    `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mobile browser fixture</title><style>*{box-sizing:border-box}body{margin:0;font:18px system-ui}section{height:900px;background:#44bb88;padding:20px}h1{font-size:25px;margin:0 0 24px}button{position:absolute;top:100px;left:20px;width:180px;height:45px}input{position:absolute;top:175px;left:20px;width:300px;height:45px}footer{height:1500px;background:#ee4488;padding:25px}@media(min-width:500px){section{background:#f00000}}</style><section><h1>A real mobile page</h1><button onclick="document.querySelector('section').style.background='#f0b45e'">Change color</button><input aria-label="Your name" oninput="if(this.value==='Frameflow')document.querySelector('section').style.background='#cc88ee'"><p style="margin-top:220px">This page refuses iframe embedding.</p></section><footer>Scrolled to the second section.</footer>`,
  );
}).listen(4321, '127.0.0.1', () => console.log('Frameflow test website ready on 4321'));
