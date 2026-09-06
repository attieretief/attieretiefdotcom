#!/usr/bin/env node
'use strict';

/**
 * feed/build.js — the update-feed aggregator for the landing page.
 *
 * Writes feed.json at the repo root; index.html fetches it and renders the
 * "Recent" timeline. This is the second deliberate build step in the repo (the
 * first is writing/build.js) and exists for one reason: most of the sources
 * below cannot be fetched from a browser — cross-origin, rate-limited, or only
 * knowable from git history. So a Node script collects them once, at build
 * time, and the page just reads a static file.
 *
 *   node feed/build.js
 *
 * Every adapter is wrapped: a source that 404s, times out, or changes its
 * markup logs a line and is skipped. A dead source never fails the run.
 * See feed/README.md for the source list and how to add one.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://attieretief.com';
const OUT = path.join(ROOT, 'feed.json');
const TIMEOUT_MS = 15000;

// Resolved once from https://www.youtube.com/@attieretief (the channel page
// redirects to a consent wall for non-browser clients, so the id is pinned
// here rather than re-resolved on every run).
const YOUTUBE_CHANNEL_ID = 'UCqxmafgBb_pDRHwAWcqoOJQ';

// ============================================================
// Small helpers — no dependencies, deliberately
// ============================================================

function readFile(rel) {
    try {
        return fs.readFileSync(path.join(ROOT, rel), 'utf8');
    } catch {
        return null;
    }
}

/** Date the file first appeared in git history (YYYY-MM-DD), or null. */
function gitAddedDate(rel) {
    try {
        const out = execFileSync(
            'git',
            ['log', '--diff-filter=A', '--format=%cs', '--', rel],
            { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        ).trim();
        if (!out) return null;
        const lines = out.split('\n').filter(Boolean);
        return lines[lines.length - 1]; // oldest = the commit that added it
    } catch {
        return null;
    }
}

async function get(url, headers) {
    const res = await fetch(url, {
        headers: Object.assign({ 'user-agent': 'attieretief.com-feed-builder' }, headers || {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
}

async function getJson(url, headers) {
    return JSON.parse(await get(url, headers));
}

const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    mdash: '—', ndash: '–', hellip: '…', middot: '·',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
    eacute: 'é', egrave: 'è', ccedil: 'ç', euml: 'ë',
};

function decodeEntities(s) {
    return String(s)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&([a-z]+);/gi, (m, name) => {
            const key = name.toLowerCase();
            return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : m;
        });
}

const stripTags = (s) => String(s).replace(/<[^>]*>/g, '');
const clean = (s) => decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();

function truncate(s, n) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (t.length <= n) return t;
    return t.slice(0, n - 1).replace(/[\s,;:.—–-]+$/, '') + '…';
}

/** Anything date-ish -> YYYY-MM-DD, or null. */
function toDate(value) {
    if (!value) return null;
    const s = String(value).trim();
    const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    return new Date(t).toISOString().slice(0, 10);
}

// ---- tiny XML pass (enough for RSS 2.0 and Atom; no new dependency) --------

function xmlBlocks(xml, tag) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
    const out = [];
    let m;
    while ((m = re.exec(xml)) !== null) out.push(m[1]);
    return out;
}

function xmlText(block, names) {
    for (const name of names) {
        const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
        if (m && clean(m[1])) return clean(m[1]);
    }
    return '';
}

function xmlLink(block) {
    // Atom: <link rel="alternate" href="…"> (or the first <link href="…">)
    const alternate = block.match(/<link\b[^>]*\brel=["']alternate["'][^>]*>/i)
        || block.match(/<link\b[^>]*\bhref=["'][^"']+["'][^>]*>/i);
    if (alternate) {
        const href = alternate[0].match(/\bhref=["']([^"']+)["']/i);
        if (href) return decodeEntities(href[1]).trim();
    }
    // RSS: <link>url</link>
    const rss = block.match(/<link>([\s\S]*?)<\/link>/i);
    return rss ? decodeEntities(stripTags(rss[1])).trim() : '';
}

/** Parse an RSS/Atom document into normalised items. */
function parseFeedXml(xml, source) {
    const blocks = xmlBlocks(xml, 'entry').concat(xmlBlocks(xml, 'item'));
    return blocks.map((block) => {
        const date = toDate(xmlText(block, ['published', 'pubDate', 'updated', 'dc:date']));
        const title = xmlText(block, ['title']);
        const url = xmlLink(block);
        const blurb = truncate(xmlText(block, ['summary', 'description', 'media:description']), 150);
        return date && title && url ? { date, source, title, url, blurb } : null;
    }).filter(Boolean);
}

/** Try the usual feed paths, then a <link rel="alternate"> in the homepage. */
async function discoverFeed(origin) {
    for (const p of ['/feed.xml', '/rss.xml', '/atom.xml', '/index.xml']) {
        try {
            const body = await get(origin + p);
            if (/<(feed|rss)\b/i.test(body)) return { url: origin + p, body };
        } catch { /* next candidate */ }
    }
    const html = await get(origin + '/');
    const tags = html.match(/<link\b[^>]*rel=["']alternate["'][^>]*>/gi) || [];
    for (const tag of tags) {
        if (!/type=["']application\/(rss|atom)\+xml["']/i.test(tag)) continue;
        const href = tag.match(/\bhref=["']([^"']+)["']/i);
        if (!href) continue;
        const url = new URL(decodeEntities(href[1]), origin + '/').toString();
        const body = await get(url);
        if (/<(feed|rss)\b/i.test(body)) return { url, body };
    }
    throw new Error('no RSS/Atom feed advertised');
}

// ============================================================
// Adapters — each returns an array of {date, source, title, url, blurb}
// ============================================================

/**
 * writing/ — one item per poem, dated by the commit that added its page.
 *
 * CLAUDE.md documents writing/works.js as the table-of-contents source, but the
 * 2026-08-12 republish dropped it; writing/index.html is now the only list of
 * poems in the repo, so that is what we parse. works.js is still preferred if
 * it comes back.
 */
function writingAdapter() {
    const works = readFile('writing/works.js');
    const index = readFile('writing/index.html');
    const entries = [];

    if (works) {
        const re = /["']?slug["']?\s*:\s*["']([^"']+)["'][\s\S]{0,200}?["']?title["']?\s*:\s*["']([^"']+)["']/g;
        let m;
        while ((m = re.exec(works)) !== null) entries.push({ slug: m[1], title: m[2], lang: '' });
    }

    if (!entries.length) {
        if (!index) throw new Error('neither writing/works.js nor writing/index.html found');
        const re = /<a\s+class="work"\s+href="\/writing\/poetry\/([^"/]+)\/"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(index)) !== null) {
            const inner = m[2];
            const lang = (inner.match(/<span class="lang">([^<]*)<\/span>/) || [])[1] || '';
            const title = clean((inner.match(/<span class="work-title">([\s\S]*?)<\/span>/) || [])[1] || '');
            if (title) entries.push({ slug: m[1], title, lang: lang.trim() });
        }
    }

    const language = { AF: 'Afrikaans', EN: 'English' };
    return entries.map((e) => {
        const date = gitAddedDate(`writing/poetry/${e.slug}/index.html`);
        if (!date) return null;
        return {
            date,
            source: 'writing',
            title: e.title,
            url: `${SITE}/writing/poetry/${e.slug}/`,
            blurb: language[e.lang] ? `${language[e.lang]} poem` : 'Poem',
        };
    }).filter(Boolean);
}

/**
 * research/ — one item per *dated event*, not one per paper. A paper's real news
 * is "submitted to X" and "accepted by Y", each with its own date, so the page
 * carries that record as data: an <ol class="paper-history"> whose every <li>
 * holds a <time datetime="YYYY-MM-DD"> and the event in words. This adapter is
 * that list's only consumer.
 *
 * A paper with no history — one still in preparation — has no dated event and
 * so contributes nothing. That is deliberate: "in preparation" is a state, not
 * something that happened on a day, and dating it by the git-added date of the
 * page (what this adapter used to do) put the whole listing on the timeline
 * every time the file moved.
 */
function researchAdapter() {
    const html = readFile('research/index.html');
    if (!html) throw new Error('research/index.html not found');

    const items = [];
    // Matched with the opening tag kept, unlike xmlBlocks(), because the id
    // attribute on <article> is what each paper's permalink is built from.
    const articles = /<article\b([^>]*)>([\s\S]*?)<\/article>/g;
    let article;
    while ((article = articles.exec(html)) !== null) {
        const [, attrs, block] = article;
        const title = clean((block.match(/<div class="paper-title">([\s\S]*?)<\/div>/) || [])[1] || '');
        if (!title) continue;

        // Per-paper anchor, so each paper's events link to the paper itself.
        const id = (attrs.match(/\bid="([^"]+)"/) || [])[1] || '';
        const url = `${SITE}/research/${id ? `#${id}` : ''}`;

        const history = (block.match(/<ol class="paper-history">([\s\S]*?)<\/ol>/) || [])[1] || '';
        const li = /<li>([\s\S]*?)<\/li>/g;
        let m;
        while ((m = li.exec(history)) !== null) {
            const date = toDate((m[1].match(/\bdatetime="([^"]+)"/) || [])[1]);
            const event = clean(m[1].replace(/<time\b[\s\S]*?<\/time>/i, ''));
            if (date && event) items.push({ date, source: 'research', title, url, blurb: truncate(event, 150) });
        }
    }
    return items;
}

/**
 * video/ — video/index.html holds no static entries (it renders playlists from
 * the YouTube Data API at runtime), so the channel's Atom feed is the source.
 * Deduped on video id in case a video is ever also listed by hand.
 */
async function videoAdapter() {
    const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
    const seen = new Set();
    return parseFeedXml(xml, 'video').filter((item) => {
        const id = (item.url.match(/[?&]v=([A-Za-z0-9_-]+)/) || [])[1] || item.url;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    }).map((item) => Object.assign(item, { blurb: truncate(item.blurb, 110) }));
}

/**
 * music/ — published scores are public gists (the music sub-site has no other
 * backend). Both collection tags from music/lib.js are included, matching what
 * the library page shows.
 *
 * Deliberately anonymous. Do NOT pass the Actions GITHUB_TOKEN here: it is
 * scoped to this repository and 403s on another user's gists, which silently
 * cost the feed all 13 scores on the first scheduled run. One unauthenticated
 * call a day is nowhere near the 60/hr anonymous limit. GIST_READ_TOKEN is
 * honoured if a real PAT is ever needed.
 */
async function musicAdapter() {
    const headers = process.env.GIST_READ_TOKEN
        ? { authorization: `Bearer ${process.env.GIST_READ_TOKEN}` }
        : {};
    const gists = await getJson('https://api.github.com/users/attieretief/gists?per_page=100', headers);
    const collections = {
        '[abc-music]': 'Worship song',
        '[abc-original]': 'Original composition',
    };

    return gists.map((g) => {
        const description = (g.description || '').trim();
        const tag = Object.keys(collections).find((t) => description.startsWith(t));
        if (!tag) return null;
        const title = description.slice(tag.length).replace(/\s+/g, ' ').trim();
        const date = toDate(g.created_at);
        if (!title || !date) return null;
        return {
            date,
            source: 'music',
            title,
            url: `${SITE}/music/view.html?id=${encodeURIComponent(g.id)}`,
            blurb: collections[tag],
        };
    }).filter(Boolean);
}

/**
 * cosmic-wonder/ — a single entry for the book page. Later milestones (a
 * publication date, a launch) go in feed/news.json rather than here.
 */
function cosmicWonderAdapter() {
    const date = gitAddedDate('cosmic-wonder/index.html');
    if (!date) throw new Error('no git history for cosmic-wonder/index.html');
    const html = readFile('cosmic-wonder/index.html') || '';
    const description = clean((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
    return [{
        date,
        source: 'book',
        title: 'Reasonable Wonder',
        url: `${SITE}/cosmic-wonder/`,
        blurb: truncate(description || 'How the newest physics echoes the oldest story', 150),
    }];
}

/**
 * genealogy/ — the genealogy build publishes its own normalised feed. It lives
 * in this repo, so read it off disk; fall back to the published copy so the
 * aggregator still works if the site is ever split out.
 */
async function genealogyAdapter() {
    const local = readFile('genealogy/feed.json');
    const items = local ? JSON.parse(local) : await getJson(`${SITE}/genealogy/feed.json`);
    return items.map((item) => {
        const date = toDate(item.date);
        if (!date || !item.title || !item.url) return null;
        return {
            date,
            source: 'genealogy',
            title: clean(item.title),
            url: item.url,
            blurb: truncate(item.blurb || '', 150),
        };
    }).filter(Boolean);
}

/** aletheia / paraverses — separately hosted, discovered by feed autodiscovery. */
function subdomainAdapter(origin, source) {
    return async () => {
        const { url, body } = await discoverFeed(origin);
        const items = parseFeedXml(body, source);
        if (!items.length) console.log(`  (${url} is a valid feed but has no entries yet)`);
        return items;
    };
}

/**
 * feed/news.json — hand-maintained one-offs: milestones, talks, launches.
 *
 * Entries also carry a "trace" field naming the line of record the date came
 * from (a commit, a memory file, a tracker row). It is provenance for whoever
 * edits the file next, never published: the object rebuilt below drops it, so
 * it cannot reach feed.json or the page.
 */
function newsAdapter() {
    const raw = readFile('feed/news.json');
    if (!raw) return [];
    return JSON.parse(raw).map((item) => {
        const date = toDate(item.date);
        if (!date || !item.title || !item.url) return null;
        return {
            date,
            source: item.source || 'news',
            title: String(item.title).trim(),
            url: String(item.url).trim(),
            blurb: truncate(item.blurb || '', 150),
        };
    }).filter(Boolean);
}

// linc.co.za — no adapter. Probed 2026-09-06: no /sitemap.xml, /rss.xml or
// /feed.xml, and no <link rel="alternate"> on the homepage, so there is nothing
// dated to read. If the marketing site ever gains a feed or a sitemap with
// <lastmod>, add it here with subdomainAdapter('https://linc.co.za', 'linc').

// LinkedIn — no adapter, and there will not be one. LinkedIn has no public API
// for a member's posts and forbids scraping; the profile stays a link-card only.

// news runs first so a hand-written entry wins the URL de-duplication below
// against a generated one for the same page.
const ADAPTERS = [
    ['news', newsAdapter],
    ['writing', writingAdapter],
    ['research', researchAdapter],
    ['video', videoAdapter],
    ['music', musicAdapter],
    ['book', cosmicWonderAdapter],
    ['genealogy', genealogyAdapter],
    ['aletheia', subdomainAdapter('https://aletheia.attieretief.com', 'aletheia')],
    ['paraverses', subdomainAdapter('https://paraverses.attieretief.com', 'paraverses')],
];

// ============================================================
// Run
// ============================================================

/**
 * Sources that produced items last time must produce items this time. A single
 * source going quiet is not "one source being down" — it is a break, and left
 * unguarded it silently shrinks the published feed. (It already did once: the
 * Actions token 403'd on the gists API and the feed lost all 13 scores.)
 */
function checkForRegression(counts) {
    const previous = readFile('feed.json');
    if (!previous) return [];
    const before = new Set();
    for (const item of JSON.parse(previous)) before.add(item.source);
    return [...before].filter((source) => !counts[source]);
}

async function main() {
    const items = [];
    const counts = {};

    for (const [name, adapter] of ADAPTERS) {
        try {
            const got = await adapter();
            items.push(...got);
            for (const item of got) counts[item.source] = (counts[item.source] || 0) + 1;
            console.log(`${name.padEnd(11)} ${String(got.length).padStart(3)} items`);
        } catch (err) {
            console.log(`${name.padEnd(11)}   – skipped: ${err.message}`);
        }
    }

    const produced = Object.keys(counts).length;

    const lost = checkForRegression(counts);
    if (lost.length) {
        console.error(`\nRefusing to write: ${lost.join(', ')} produced items last run and none now.`);
        process.exit(1);
    }

    // Two-tier de-duplication. Within a source, an item is identified by URL +
    // title + date: research/ emits several events for one paper — submitted,
    // then accepted — which share a URL and a title and differ only by date.
    // Across sources, the first adapter to claim a URL keeps it — that is how
    // a hand-written news entry replaces the generated one for the same page.
    const seen = new Set();
    const urlOwner = new Map();
    const unique = [];
    for (const item of items) {
        const key = `${item.source}|${item.url}|${item.title}|${item.date}`;
        const owner = urlOwner.get(item.url);
        if (seen.has(key) || (owner && owner !== item.source)) continue;
        seen.add(key);
        if (!owner) urlOwner.set(item.url, item.source);
        unique.push(item);
    }

    const feed = unique.sort((a, b) =>
        b.date.localeCompare(a.date)
        || a.source.localeCompare(b.source)
        || a.title.localeCompare(b.title));

    fs.writeFileSync(OUT, JSON.stringify(feed, null, 2) + '\n');
    console.log(`\nfeed.json — ${feed.length} items from ${produced} sources (newest ${feed[0] ? feed[0].date : 'n/a'})`);

    if (produced < 4) {
        console.error(`\nOnly ${produced} sources produced items — expected at least 4.`);
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
