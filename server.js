// Vijeta Wings — chhota sa static server (koi extra package nahi chahiye).
// Render par:  Build Command = npm install   |   Start Command = npm start
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }

    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 — Page nahi mila'); }
      const ext = path.extname(filePath).toLowerCase();
      const isImage = /\.(jpg|jpeg|png|webp|gif|svg|ico)$/.test(ext);
      res.writeHead(200, {
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        // HTML / dates.txt hamesha taaza dikhe; images 1 din cache
        'Cache-Control': isImage ? 'public, max-age=86400' : 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    res.writeHead(400); res.end('Bad request');
  }
}).listen(PORT, '0.0.0.0', () => console.log('Vijeta Wings chal raha hai — port ' + PORT));
