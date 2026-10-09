import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {once} from 'node:events';
process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
const {server} = await import('./server.mjs');
if (!server.listening) await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url)));
try {
  let count = 0;
  const assets = new Set(['/preview.js']);
  for (const key of Object.keys(manifest.pages)) {
    const [store, mode, route] = key.split(':');
    const response = await fetch(origin + route + (mode === 'pane' ? `?pane=1&ps=${store}` : ''), {headers:{cookie:`preview_store=${store}`}});
    assert.equal(response.status, 200, key);
    const html = await response.text();
    assert.ok(html.includes(`data-store="${store}"`), key);
    assert.equal(html.includes('class="app-shell pane-body"'), mode === 'pane', key);
    assert.ok(!/(?:data-csrf="|name="csrf"\s+value=")(?!design-preview")/.test(html), 'Unexpected CSRF token');
    for (const match of html.matchAll(/(?:src|href)="(\/static\/[^"#]+)/g)) assets.add(match[1]);
    count++;
  }
  for (const asset of assets) assert.equal((await fetch(origin+asset)).status, 200, asset);
  const blocked = await fetch(origin+'/settings', {method:'POST'});
  assert.equal(blocked.status, 405);
  const redirect = await fetch(origin+'/summary/3?pane=1', {redirect:'manual'});
  assert.equal(redirect.headers.get('location'), '/?pane=1&ps=3');
  assert.ok(redirect.headers.get('set-cookie').startsWith('preview_pane_store=3;'));
  assert.equal((await fetch(origin+'/not-in-prototype')).status, 404);
  const files = await readdir(new URL('.', import.meta.url), {recursive:true});
  assert.ok(!files.some(f=>/(^|\/)(\.env|\.git)(\/|$)|\.db(?:-|$)/.test(f)));
  console.log(`PASS: ${count} pages; ${assets.size} assets; pane isolation; POST guard; no env/git/database.`);
} finally {server.closeAllConnections(); server.close();}
