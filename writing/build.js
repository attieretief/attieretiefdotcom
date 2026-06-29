#!/usr/bin/env node
/* writing/build.js — the curation + binder for the writing collection.
   ─────────────────────────────────────────────────────────────────────
   Run it whenever you publish (or re-order) work:

       node writing/build.js

   What it does, from the single editorial source below (COLLECTIONS):
     1. Reads each poem page to pick up its real title.
     2. Regenerates writing/works.js  → drives the table of contents.
     3. Stamps every poem page with:
          • a collection "kicker" (which bundle it belongs to), and
          • a prev / next pager so reading pages through the bundle.
     It is idempotent — safe to run again and again.

   ── To CURATE ──────────────────────────────────────────────────────
   Everything is decided here. Each block is one collection; array order
   is the reading order, both of the collections and of poems within them.
   Move a slug, rename a `theme`, reorder a block — rerun — done.

   ── To ADD a new poem ──────────────────────────────────────────────
   Create writing/poetry/<slug>/index.html (copy an existing one, swap the
   text — it already links book.css), add its <slug> to a collection below,
   and rerun. Any poem page NOT listed here is reported and dropped into an
   "Uncollected" section so nothing silently disappears.
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'poetry');

/* ───────────────────────── EDITORIAL SOURCE ───────────────────────── */
const COLLECTIONS = [
  // ===== AFRIKAANS =====
  { lang: 'Afrikaans', theme: 'Die alledaagse', slugs: [
    '9-55', 'stadswolf', 'medemens', 'nagviooltjie', 'politieke-duif-van-my', 'kom-ons-dans-oor-irak' ] },
  { lang: 'Afrikaans', theme: 'Verlange', slugs: [
    'iemand', 'verlange', 'eenrigting-liefde', 'weet-jy' ] },
  { lang: 'Afrikaans', theme: 'Liefde', slugs: [
    'die-soen', 'jy', 'braille', 'jys-my-berg',
    'geseend', 'leplek-vir-n-kind', 'die-rede', 'liedjie', 'mooi-dag', 'ballade-vir-die-reenkind' ] },
  { lang: 'Afrikaans', theme: 'Troue & tuiste', slugs: [
    'troudag', 'hierdie-huisie', 'die-wonderwerk' ] },
  { lang: 'Afrikaans', theme: 'By die see', slugs: [
    'heroldsbaai', 'spoelgety', 'by-die-see', 'rotsgeloop' ] },
  { lang: 'Afrikaans', theme: 'Geloof', slugs: [
    'alfa', 'bekeringslied', 'behoud', 'pater-noster', 'doodsbegeerte' ] },
  { lang: 'Afrikaans', theme: 'Verlies & herinnering', slugs: [
    'oupa', 'oumsie', 'ou-oom-boesman', 'marta', 'sewe-grepe', 'dode',
    'aan-n-budjie', 'ontmoeting-en-skeiding', 'icarus-varie' ] },
  { lang: 'Afrikaans', theme: 'Self & twyfel', slugs: [
    'twyfel', 'genoeg', 'judas-van-self', 'verstaan-my', 'by-die-versilwering-van-my-donker-wolk' ] },
  { lang: 'Afrikaans', theme: 'Oor musiek & skryf', slugs: [
    'musiek', 'gedagtes-oor-musiek-en-klank', 'in-die-konsertsaal', 'oor-my-skryf' ] },

  // ===== ENGLISH =====
  { lang: 'English', theme: 'Love & longing', slugs: [
    'how-in-love-am-i-with-thee', 'discovery', 'seasons-apart', 'afar',
    'fighting', 'you-haunt-me', 'wife-to-be' ] },
  { lang: 'English', theme: 'Devotion & togetherness', slugs: [
    'god-in-you', 'memory', 'im-here' ] },
  { lang: 'English', theme: 'Self & shadow', slugs: [
    'introspection-1', 'caught-up-in-my-dreams',
    'a-mentally-disturbeds-two-meditations-on-his-behaviour',
    'she-is-the-product-of-each-misjudged-love', 'messiah' ] },
  { lang: 'English', theme: 'Sea, land & journey', slugs: [
    'victoria-falls', 'on-wandering-around-in-africa', 'running',
    'dead-reckoning', 'under-the-tree' ] },
];

// Per-language wording for the pager (so English pages read in English).
const WORDS = {
  Afrikaans: { prev: 'Vorige', next: 'Volgende', contents: 'Inhoud' },
  English:   { prev: 'Previous', next: 'Next', contents: 'Contents' },
};
const UNCOLLECTED = 'Uncollected';
const AUTHOR = 'Attie Retief';

// Genre display name per language (the URL slug stays the canonical key, e.g. "poetry").
const GENRE_LABELS = {
  Poetry: { Afrikaans: 'Poësie', English: 'Poetry' },
  // 'Short Stories': { Afrikaans: 'Kortverhale', English: 'Short Stories' },
  // Essays:          { Afrikaans: 'Essays',      English: 'Essays' },
  // Plays:           { Afrikaans: 'Toneelstukke', English: 'Plays' },
};
function genreLabel(key, lang) {
  return (GENRE_LABELS[key] && GENRE_LABELS[key][lang]) || key;
}

/* ───────────────────────────── helpers ───────────────────────────── */
function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&middot;/g, '·').replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, '’').replace(/&hellip;/g, '…').trim();
}
function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' en ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function titleOf(slug) {
  const file = path.join(ROOT, slug, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<h1>([\s\S]*?)<\/h1>/);
  return m ? decode(m[1].replace(/<br\s*\/?>/gi, ' ')) : slug;
}
const INTRO = 'A back catalogue of creative work in two languages — poetry, ' +
  'short stories, essays, and plays, in Afrikaans and English.';
function pathOf(lang, genre, theme) {
  return slugify(lang) + '/' + slugify(genre) + '/' + slugify(theme);
}

/* ─────────────────────── gather + validate ───────────────────────── */
const onDisk = fs.readdirSync(ROOT).filter(d =>
  fs.existsSync(path.join(ROOT, d, 'index.html')));
const onDiskSet = new Set(onDisk);
const placed = new Set();
const missing = [];

// Flat, ordered collection records: { lang, genreKey, theme, works }
const records = [];
for (const c of COLLECTIONS) {
  const genreKey = c.genre || 'Poetry';
  const works = [];
  for (const slug of c.slugs) {
    if (!onDiskSet.has(slug)) { missing.push(slug); continue; }
    placed.add(slug);
    works.push({ slug, title: titleOf(slug), href: '/writing/poetry/' + slug + '/' });
  }
  if (works.length) records.push({ lang: c.lang, genreKey, theme: c.theme, works });
}

// Anything on disk but not curated → Uncollected (Poetry) by language, so it still shows.
const orphans = onDisk.filter(s => !placed.has(s));
if (orphans.length) {
  const byLang = {};
  for (const slug of orphans) {
    const html = fs.readFileSync(path.join(ROOT, slug, 'index.html'), 'utf8');
    const lang = /Afrikaans/.test(html) ? 'Afrikaans' : 'English';
    (byLang[lang] = byLang[lang] || []).push(
      { slug, title: titleOf(slug), href: '/writing/poetry/' + slug + '/' });
  }
  for (const lang of Object.keys(byLang))
    records.push({ lang, genreKey: 'Poetry', theme: UNCOLLECTED, works: byLang[lang] });
}

/* ─────────── nest into languages → genres → collections ──────────── */
const langs = [];                 // ordered [{ label, slug, genres:[{name,slug,collections:[]}] }]
const langMap = {};
for (const r of records) {
  let L = langMap[r.lang];
  if (!L) { L = { label: r.lang, slug: slugify(r.lang), genres: [], _g: {} }; langMap[r.lang] = L; langs.push(L); }
  let G = L._g[r.genreKey];
  if (!G) {
    G = { name: genreLabel(r.genreKey, r.lang), slug: slugify(r.genreKey), collections: [] };
    L._g[r.genreKey] = G; L.genres.push(G);
  }
  G.collections.push({
    theme: r.theme, slug: slugify(r.theme),
    path: pathOf(r.lang, r.genreKey, r.theme), works: r.works });
}

/* ─────── paging sequence, within each language+genre bundle ──────── */
const place = {};                 // slug -> entry with prev/next resolved
for (const L of langs) for (const G of L.genres) {
  const seq = [];
  for (const c of G.collections) c.works.forEach((w, i) => seq.push({
    ...w, theme: c.theme, lang: L.label, langSlug: L.slug, genre: G.name, genreSlug: G.slug,
    cpath: c.path, idxInTheme: i + 1, themeCount: c.works.length }));
  seq.forEach((e, i) => { place[e.slug] = { ...e, prev: seq[i - 1] || null, next: seq[i + 1] || null }; });
}

/* ───────────────────────── write works.js ────────────────────────── */
const data = {
  intro: INTRO,
  languages: langs.map(L => ({
    label: L.label, slug: L.slug,
    genres: L.genres.map(G => ({
      name: G.name, slug: G.slug,
      collections: G.collections.map(c => ({
        theme: c.theme, slug: c.slug, path: c.path,
        works: c.works.map(w => ({ title: w.title, href: w.href })) })) })) })),
};
fs.writeFileSync(path.join(__dirname, 'works.js'),
  '/* writing/works.js — GENERATED by writing/build.js. Do not edit by hand.\n' +
  '   Curation lives in writing/build.js (COLLECTIONS); run `node writing/build.js`. */\n' +
  'window.WRITING = ' + JSON.stringify(data, null, 2) + ';\n');

/* ─────────────── stamp kicker + pager into each page ──────────────── */
const KICKER_RE = /[ \t]*<!--kicker-->[\s\S]*?<!--\/kicker-->\n?/;
const BYLINE_RE = /[ \t]*<!--byline-->[\s\S]*?<!--\/byline-->\n?/;
const PAGER_RE  = /[ \t]*<!--pager-->[\s\S]*?<!--\/pager-->\n?/;
const BACKLINK_RE = /[ \t]*<a class="backlink"[\s\S]*?<\/a>\n?/;
const SECTION_RE = /<span class="section">[\s\S]*?<\/span>/;

function pagerLink(cls, entry, word) {
  if (!entry) return '<span class="' + cls + ' ph"></span>';
  const arrow = cls === 'prev' ? '‹ ' : '';
  const arrow2 = cls === 'next' ? ' ›' : '';
  return '<a class="' + cls + '" href="' + esc(entry.href) + '">' + arrow + esc(word) + arrow2 +
    '<span class="label">' + esc(entry.title) + '</span></a>';
}

let stamped = 0;
for (const slug of placed.size ? [...placed, ...orphans] : []) {
  const file = path.join(ROOT, slug, 'index.html');
  const p = place[slug];
  if (!p) continue;
  let html = fs.readFileSync(file, 'utf8');
  const w = WORDS[p.lang] || WORDS.English;

  // clean any previous stamps + legacy backlink
  html = html.replace(KICKER_RE, '').replace(BYLINE_RE, '').replace(PAGER_RE, '').replace(BACKLINK_RE, '');

  // breadcrumb — Writing / <Language> / <Genre>, each a drill-down link
  const crumb = '<span class="section">/ <a href="/writing/">Writing</a> ' +
    '/ <a href="/writing/#/' + p.langSlug + '">' + esc(p.lang) + '</a> ' +
    '/ <a href="/writing/#/' + p.langSlug + '/' + p.genreSlug + '">' + esc(p.genre) + '</a></span>';
  html = html.replace(SECTION_RE, crumb);

  // kicker — the collection this poem sits in
  const kicker = '<!--kicker-->\n<div class="kicker">' + esc(p.theme) +
    '</div>\n<!--/kicker-->\n';
  html = html.replace(/(<div class="piece-header">\s*\n)/, '$1' + kicker);

  // byline — clear authorship under the title
  const byline = '<!--byline-->\n<div class="byline">by ' + esc(AUTHOR) + '</div>\n<!--/byline-->\n';
  html = html.replace(/(<h1>[\s\S]*?<\/h1>\n)/, '$1' + byline);

  // pager — previous / contents / next, paging through the bundle
  const contents = '<a class="contents" href="/writing/#/' + p.cpath + '">' +
    esc(p.theme) + '<span class="pos">' + p.idxInTheme + ' / ' + p.themeCount + '</span></a>';
  const pager = '<!--pager-->\n<nav class="pager">\n' +
    pagerLink('prev', p.prev, w.prev) + '\n' + contents + '\n' +
    pagerLink('next', p.next, w.next) + '\n</nav>\n<!--/pager-->\n';
  html = html.replace(/(\s*)<footer/, '\n' + pager + '<footer');

  fs.writeFileSync(file, html);
  stamped++;
}

/* ───────────────────────────── report ────────────────────────────── */
const total = records.reduce((n, c) => n + c.works.length, 0);
console.log('Languages   : ' + langs.map(L =>
  L.label + ' (' + L.genres.map(G => G.name + ' ' + G.collections.length).join(', ') + ')').join('  |  '));
console.log('Poems       : ' + total + ' placed, ' + stamped + ' pages stamped');
if (orphans.length) console.log('Uncollected : ' + orphans.join(', ') + '  (add to COLLECTIONS to curate)');
if (missing.length) console.log('MISSING dir : ' + missing.join(', ') + '  (slug in build.js has no page)');
console.log('Wrote writing/works.js');
