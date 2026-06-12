// music/library.js — list public gists, split into collection sections
(function () {
    'use strict';

    const { GistAPI, CONFIG } = window.AbcMusic;

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }

    function relativeTime(iso) {
        const d = new Date(iso);
        const diff = Date.now() - d.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + 'm ago';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h ago';
        const days = Math.floor(hrs / 24);
        if (days < 30) return days + 'd ago';
        return d.toLocaleDateString();
    }

    const scoreIcon =
        '<span class="score-row-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
        '</span>';

    function renderRows(scores, filter) {
        const q = (filter || '').trim().toLowerCase();
        const matching = q
            ? scores.filter(s => s.title.toLowerCase().includes(q))
            : scores;

        if (!matching.length) {
            return q
                ? '<div class="score-empty">No scores match "' + escapeHtml(q) + '".</div>'
                : '';
        }
        return '<ul class="score-list">' + matching.map(s =>
            '<li><a class="score-row-main" href="' + s.viewerUrl + '">' +
            '  ' + scoreIcon +
            '  <span class="score-row-title">' + escapeHtml(s.title) + '</span>' +
            '  <span class="score-row-meta">Updated ' + s.updated + '</span>' +
            '</a></li>'
        ).join('') + '</ul>';
    }

    // Wire a section's search box to its own score list / count, scoped by ids.
    function attachSearch(scores, ids) {
        const $search = document.getElementById(ids.search);
        const $list = document.getElementById(ids.list);
        const $count = document.getElementById(ids.count);
        if (!$search || !$list) return;
        const update = () => {
            $list.innerHTML = renderRows(scores, $search.value);
            const q = $search.value.trim().toLowerCase();
            const shown = q ? scores.filter(s => s.title.toLowerCase().includes(q)).length : scores.length;
            if ($count) {
                $count.textContent = shown === scores.length
                    ? scores.length + ' score' + (scores.length === 1 ? '' : 's')
                    : shown + ' of ' + scores.length;
            }
        };
        $search.addEventListener('input', update);
        update();
    }

    function renderSection(host, scores, emptyHtml) {
        if (!host) return;
        if (!scores.length) {
            host.innerHTML = emptyHtml;
            return;
        }
        const ids = {
            search: host.id + '-search',
            list:   host.id + '-list',
            count:  host.id + '-count'
        };
        host.innerHTML =
            '<div class="score-toolbar">' +
            '  <input type="search" class="score-search" id="' + ids.search + '" placeholder="Search scores by title…" autocomplete="off">' +
            '  <span class="score-count" id="' + ids.count + '"></span>' +
            '</div>' +
            '<div id="' + ids.list + '"></div>';
        attachSearch(scores, ids);
    }

    function emptyStateFor(col) {
        return '' +
            '<div class="empty-state">' +
            '  <h3>No scores yet</h3>' +
            '  <p>Once you publish a score to <strong>' + escapeHtml(col.label) + '</strong> from the editor, it’ll appear here.</p>' +
            '  <a href="/music/edit.html?new=1" class="btn btn-primary">Open editor</a>' +
            '</div>';
    }

    function errorStateFor(message) {
        return '' +
            '<div class="empty-state">' +
            '  <h3>Could not load library</h3>' +
            '  <p>' + escapeHtml(message) + '</p>' +
            '</div>';
    }

    async function load() {
        const cols = CONFIG.collections || [{ tag: CONFIG.gistTag, label: 'Scores', hostId: 'library-content' }];
        try {
            const all = await GistAPI.fetchAll(CONFIG.githubUser);
            cols.forEach(col => {
                const host = document.getElementById(col.hostId);
                if (!host) return;
                const scores = all
                    .filter(g => g.description && g.description.startsWith(col.tag))
                    .map(g => ({
                        title: GistAPI.titleOf(g),
                        updated: relativeTime(g.updated_at),
                        viewerUrl: '/music/view.html?id=' + encodeURIComponent(g.id)
                    }));
                renderSection(host, scores, emptyStateFor(col));
            });
        } catch (err) {
            console.error(err);
            cols.forEach(col => {
                const host = document.getElementById(col.hostId);
                if (host) host.innerHTML = errorStateFor(err.message);
            });
        }
    }

    load();
})();
