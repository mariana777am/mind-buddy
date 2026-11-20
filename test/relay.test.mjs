// fake old-style "ICY 200 OK" station → relay → a normal HTTP audio response
import net from 'node:net'; import http from 'node:http';
import { relayStream } from '../lib/streamproxy.js';
const icy = net.createServer(s => { s.once('data', () => { s.write('ICY 200 OK\r\nicy-name: Test FM\r\ncontent-type: audio/mpeg\r\n\r\n'); s.write(Buffer.from([0xff, 0xfb, 0x90, 0x64, 1, 2, 3])); setTimeout(() => s.end(), 100); }); }).listen(0);
const redir = http.createServer((q, r) => { r.writeHead(302, { location: `http://127.0.0.1:${icy.address().port}/live` }); r.end(); }).listen(0);
const html = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<html>'); }).listen(0);
const logs = []; const relay = http.createServer((q, r) => relayStream(new URL(q.url, 'http://x').searchParams.get('u'), r, { log: m => logs.push(m) })).listen(0);
await new Promise(r => setTimeout(r, 200));
const get = async u => { const r = await fetch(`http://127.0.0.1:${relay.address().port}/?u=${encodeURIComponent(u)}`); return [r.status, r.headers.get('content-type'), (await r.arrayBuffer()).byteLength]; };
console.log('old-style ICY station      →', await get(`http://127.0.0.1:${icy.address().port}/;`));
console.log('station that redirects     →', await get(`http://127.0.0.1:${redir.address().port}/stream`));
console.log('link that is a web page    →', await get(`http://127.0.0.1:${html.address().port}/`), '|', logs.at(-1));
console.log('station that is offline    →', await get('http://127.0.0.1:1/'), '|', logs.at(-1));
process.exit(0);
