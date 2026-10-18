const path = require('node:path');
function contentPath(root, requestURL) {
  const url = new URL(requestURL);
  if (url.protocol !== 'ark:' || url.hostname !== 'game' || url.search) return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return null; }
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(path.resolve(root) + path.sep)) return null;
  if (!['.html','.js','.css','.json','.glb','.png','.jpg','.jpeg','.svg','.mp3','.wav','.ogg','.woff2','.txt'].includes(path.extname(file))) return null;
  if (path.extname(file) === '.html' && pathname !== '/index.html') return null;
  return file;
}
module.exports = {contentPath};
