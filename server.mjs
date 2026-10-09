import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const types = {'.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.woff2':'font/woff2', '.html':'text/html', '.jpg':'image/jpeg', '.mp4':'video/mp4'};
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const server = http.createServer(async (req, res) => {
  const send = (status, body, type='text/html') => {res.writeHead(status, {'Content-Type':type+'; charset=utf-8', 'Cache-Control':'no-store'}); res.end(body);};
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!['GET','HEAD'].includes(req.method)) return send(405, '<h1>Дизайн-версия</h1><p>Сохранение данных и серверные операции отключены.</p><a href="/">Вернуться</a>');
    if (url.pathname.startsWith('/static/') || url.pathname === '/preview.js') {
      const file = path.resolve(root, 'public', '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(path.join(root, 'public') + path.sep)) return send(403, 'Forbidden');
      return send(200, await readFile(file), types[path.extname(file)] || 'application/octet-stream');
    }
    const cookie = Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=')));
    const pane = url.searchParams.get('pane') === '1';
    let store = pane ? url.searchParams.get('ps') || cookie.preview_pane_store || cookie.preview_store : cookie.preview_store;
    const summary = /^\/summary\/(\d+)$/.exec(url.pathname);
    if (summary) store = summary[1];
    if (!manifest.stores[store]) store = '1';
    res.setHeader('Set-Cookie', `${pane ? 'preview_pane_store' : 'preview_store'}=${store}; Path=/; SameSite=Lax`);
    if (summary) {
      let next = url.searchParams.get('next') || '/';
      if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) next = '/';
      const target = new URL(next, 'http://localhost');
      if (pane) {target.searchParams.set('pane','1'); target.searchParams.set('ps',store);}
      res.writeHead(302, {Location:target.pathname+target.search}); return res.end();
    }
    const file = manifest.pages[`${store}:${pane ? 'pane' : 'full'}:${url.pathname}`];
    if (!file) return send(404, `<h1>Экран не включён в дизайн-пакет</h1><p>${escape(url.pathname)}</p><p>Доступны 17 основных разделов и карточка демотовара каждой площадки. Авторизация, оплата и выгрузки не подключены.</p><a href="/?${pane ? 'pane=1&ps='+store : ''}">Сводка</a>`);
    return send(200, await readFile(path.join(root, file)));
  } catch (error) { send(error.code === 'ENOENT' ? 404 : 500, 'Preview resource unavailable'); }
});
const portArg = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portArg >= 0 ? process.argv[portArg+1] : 3000));
server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`seller.bz design preview: http://localhost:${port}`));
