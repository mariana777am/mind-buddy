// Radio stream relay. Many internet radio stations still answer in the old Shoutcast "ICY 200 OK" style, which
// Chrome-based players (like the music window) refuse. This fetches the stream with a plain socket, follows
// redirects, turns the answer into normal HTTP and passes the audio on. Only streams the radio search just
// returned are allowed, and it only listens on 127.0.0.1 (this PC).
import net from 'node:net';
import tls from 'node:tls';

export function relayStream(url, res, { log = () => {}, depth = 0 } = {}){
  let u; try { u = new URL(url); } catch { res.writeHead(400); return res.end(); }
  if (!/^https?:$/.test(u.protocol) || depth > 5) { res.writeHead(400); return res.end(); }
  const secure = u.protocol === 'https:', port = Number(u.port) || (secure ? 443 : 80);
  const sock = secure ? tls.connect({ host: u.hostname, port, servername: u.hostname }) : net.connect({ host: u.hostname, port });
  let head = Buffer.alloc(0), done = false;
  const fail = why => { if (done) return; done = true; log(`stream failed (${why}): ${url}`); try { sock.destroy(); } catch (_) {} if (!res.headersSent) { res.writeHead(502); res.end(); } else res.end(); };
  sock.setTimeout(10000, () => fail('no answer in 10 s'));
  sock.on('error', e => fail(e.code || e.message));
  sock.on(secure ? 'secureConnect' : 'connect', () => {
    sock.write(`GET ${u.pathname || '/'}${u.search} HTTP/1.0\r\nHost: ${u.host}\r\nUser-Agent: MindsBuddy/1.0\r\nAccept: */*\r\nIcy-MetaData: 0\r\nConnection: close\r\n\r\n`);
  });
  const onData = chunk => {
    head = Buffer.concat([head, chunk]);
    const end = head.indexOf('\r\n\r\n'); if (end < 0) { if (head.length > 16384) fail('bad header'); return; }
    sock.off('data', onData);
    const lines = head.slice(0, end).toString('latin1').split('\r\n'), status = lines[0], rest = head.slice(end + 4);
    const m = status.match(/^(?:HTTP\/\d(?:\.\d)?|ICY)\s+(\d{3})/i); if (!m) return fail('not a stream: ' + status.slice(0, 40));
    const code = Number(m[1]), hdr = {}; for (const l of lines.slice(1)) { const i = l.indexOf(':'); if (i > 0) hdr[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); }
    if (code >= 300 && code < 400 && hdr.location) { done = true; sock.destroy(); return relayStream(new URL(hdr.location, u).href, res, { log, depth: depth + 1 }); }
    if (code !== 200) return fail('HTTP ' + code);
    let type = hdr['content-type'] || 'audio/mpeg';
    if (/text\/html/i.test(type)) return fail('web page, not audio');
    if (/mpegurl|x-scpls|pls|m3u/i.test(type)) return fail('playlist, not audio');
    if (/octet-stream/i.test(type) || !/audio|ogg|aac|mpeg/i.test(type)) type = 'audio/mpeg';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
    sock.setTimeout(0);
    if (rest.length) res.write(rest);
    sock.pipe(res);
    sock.on('end', () => { done = true; res.end(); });
  };
  sock.on('data', onData);
  res.on('close', () => { done = true; try { sock.destroy(); } catch (_) {} });
}
