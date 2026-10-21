// Copies the built site into a folder where every internal link is relative and points at
// an explicit index.html. Only needed for viewing the build somewhere that isn't a real web
// server (a shared review link, or opening the files straight from disk). Netlify doesn't
// need this: deploy dist/ as-is.
//
//   node scripts/relativize.mjs dist out/site
import { readdirSync, statSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';

const [src = 'dist', out = 'dist-relative'] = process.argv.slice(2);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function rewrite(target, depth) {
  const m = target.match(/^([^?#]*)([?#].*)?$/);
  let path = m[1].replace(/^\//, '');
  const tail = m[2] ?? '';
  if (path === '' || path.endsWith('/')) path += 'index.html';
  else if (!extname(path)) path += '/index.html';
  return ('../'.repeat(depth) || './') + path + tail;
}

for (const file of walk(src)) {
  const rel = relative(src, file);
  const dest = join(out, rel);
  mkdirSync(dirname(dest), { recursive: true });
  if (!file.endsWith('.html')) { copyFileSync(file, dest); continue; }
  const depth = rel.split('/').length - 1;
  let html = readFileSync(file, 'utf8');
  html = html.replace(/\b(href|src|action)="(\/(?!\/)[^"]*)"/g, (_, a, t) => `${a}="${rewrite(t, depth)}"`);
  html = html.replace(/\bsrcset="([^"]*)"/g, (_, v) =>
    `srcset="${v.split(',').map((part) => part.trim().replace(/^(\/(?!\/)\S*)/, (t) => rewrite(t, depth))).join(', ')}"`);
  html = html.replace(/url\((\/(?!\/)[^)]*)\)/g, (_, t) => `url(${rewrite(t, depth)})`);
  writeFileSync(dest, html);
}
console.log(`relativized ${src} -> ${out}`);
