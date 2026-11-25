import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { marked } from 'marked';

const root = path.dirname(new URL(import.meta.url).pathname);
const site = JSON.parse(fs.readFileSync(path.join(root, 'site.json'), 'utf8'));
const dist = path.join(root, 'dist');
const base = site.basePath || '';
const langs = ['es', 'en'];

const ui = {
  es: { home: 'Inicio', other: 'English', otherLang: 'en', published: 'Publicado', updated: 'Actualizado', empty: 'Aún no hay textos publicados.', back: '← Todos los textos', fingerprint: 'Huella SHA-256 del texto', author: 'Autor', example: 'Texto de ejemplo' },
  en: { home: 'Home', other: 'Español', otherLang: 'es', published: 'Published', updated: 'Updated', empty: 'No texts published yet.', back: '← All texts', fingerprint: 'SHA-256 fingerprint of the text', author: 'Author', example: 'Example text' },
};

const siteName = (lang) => (lang === 'en' ? site.nameEn : site.name);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`Falta el bloque de metadatos en ${file}`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  const body = m[2].trim();
  return { meta, body, hash: crypto.createHash('sha256').update(body, 'utf8').digest('hex') };
}

const fmtDate = (d, lang) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString(lang === 'en' ? 'en-GB' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

function layout({ lang, title, body, altHref, desc }) {
  const t = ui[lang];
  const robots = site.indexable ? '' : '<meta name="robots" content="noindex, nofollow, noimageindex">';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc || site.tagline[lang])}">
<meta name="author" content="${esc(site.author)}">
${robots}
<link rel="stylesheet" href="${base}/style.css">
</head>
<body>
<header class="top">
  <a class="brand" href="${base}/${lang}/">${esc(siteName(lang))}</a>
  <nav>${altHref ? `<a href="${altHref}" hreflang="${t.otherLang}" lang="${t.otherLang}">${t.other}</a>` : ''}</nav>
</header>
<main>
${body}
</main>
<footer>
  <p>© ${new Date().getFullYear()} ${esc(site.author)}. ${esc(site.license[lang])}</p>
</footer>
</body>
</html>
`;
}

function write(rel, content) {
  const f = path.join(dist, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(path.join(root, 'src/style.css'), path.join(dist, 'style.css'));

const archiveUrls = [];
const essays = { es: [], en: [] };

for (const lang of langs) {
  const dir = path.join(root, 'content', lang);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const { meta, body, hash } = parse(path.join(dir, f));
    if (meta.draft === 'true') continue;
    const slug = meta.slug || f.replace(/\.md$/, '');
    essays[lang].push({ ...meta, slug, body, hash });
  }
  essays[lang].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// Un idioma solo existe en la web cuando tiene al menos un texto publicado.
const activeLangs = langs.filter((l) => essays[l].length > 0);

for (const lang of activeLangs) {
  const t = ui[lang];
  const otherLang = t.otherLang;
  const otherActive = activeLangs.includes(otherLang);

  for (const e of essays[lang]) {
    const tr = e.translation && essays[otherLang].find((x) => x.slug === e.translation);
    const altHref = tr ? `${base}/${otherLang}/${tr.slug}/` : otherActive ? `${base}/${otherLang}/` : null;
    const html = marked.parse(e.body);
    const updated = e.updated ? ` · ${t.updated}: ${fmtDate(e.updated, lang)}` : '';
    const exampleNote = e.example === 'true' ? `<p class="note">${t.example}</p>` : '';
    const body = `<article>
<p class="back"><a href="${base}/${lang}/">${t.back}</a></p>
${exampleNote}
<h1>${esc(e.title)}</h1>
<p class="meta">${esc(site.author)} · ${t.published}: ${fmtDate(e.date, lang)}${updated}</p>
<div class="text">
${html}
</div>
<p class="fingerprint">${t.fingerprint}:<br><code>${e.hash}</code></p>
</article>`;
    write(`${lang}/${e.slug}/index.html`, layout({ lang, title: `${e.title} — ${siteName(lang)}`, body, altHref, desc: e.summary }));
    if (e.example !== 'true') archiveUrls.push(`${site.siteUrl}/${lang}/${e.slug}/`);
  }

  const body = `<ul class="index">${essays[lang]
    .map((e) => `<li><a href="${base}/${lang}/${e.slug}/">${esc(e.title)}</a><span class="date">${fmtDate(e.date, lang)}</span>${e.summary ? `<p>${esc(e.summary)}</p>` : ''}</li>`)
    .join('\n')}</ul>`;
  write(`${lang}/index.html`, layout({ lang, title: siteName(lang), body, altHref: otherActive ? `${base}/${otherLang}/` : null }));
}

// Entrada: elige idioma según el navegador.
write('index.html', `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.name)}</title>
${site.indexable ? '' : '<meta name="robots" content="noindex, nofollow">'}
<link rel="stylesheet" href="${base}/style.css">
<script>var a=${JSON.stringify(activeLangs)},n=(navigator.language||"es").toLowerCase().slice(0,2);location.replace("${base}/"+(a.indexOf(n)>-1?n:a[0])+"/");</script>
</head><body><main class="landing"><h1>${esc(site.name)}</h1><p>${activeLangs.map((l) => `<a href="${base}/${l}/">${l === 'en' ? 'English' : 'Español'}</a>`).join(' · ')}</p></main></body></html>
`);

// robots.txt: sin indexar y pidiendo a los rastreadores de IA que no usen el contenido.
const aiBots = ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'CCBot', 'Google-Extended', 'PerplexityBot', 'Bytespider', 'Applebot-Extended', 'Amazonbot', 'Meta-ExternalAgent', 'cohere-ai', 'Diffbot'];
write('robots.txt', aiBots.map((b) => `User-agent: ${b}\nDisallow: /\n`).join('\n') + (site.indexable ? '\nUser-agent: *\nAllow: /\n' : '\nUser-agent: *\nDisallow: /\n'));

fs.writeFileSync(path.join(root, 'archive-urls.txt'), archiveUrls.join('\n') + (archiveUrls.length ? '\n' : ''));
console.log(`Construido: ${essays.es.length} textos ES, ${essays.en.length} textos EN. URLs a archivar: ${archiveUrls.length}`);
