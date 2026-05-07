// music/library.js — list public gists tagged with [abc-music]
(function () {
    'use strict';

    const { GistAPI, CONFIG } = window.AbcMusic;
    const $content = document.getElementById('library-content');

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

    let allScores = [];

    function renderRows(filter) {
        const q = (filter || '').trim().toLowerCase();
        const matching = q
            ? allScores.filter(s => s.title.toLowerCase().includes(q))
            : allScores;

        if (!matching.length) {
            return q
                ? '<div class="score-empty">No scores match "' + escapeHtml(q) + '".</div>'
                : '';
        }
        const scoreIcon =
            '<span class="score-row-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
            '</span>';
        return '<ul class="score-list">' + matching.map(s =>
            '<li><a class="score-row-main" href="' + s.viewerUrl + '">' +
            '  ' + scoreIcon +
            '  <span class="score-row-title">' + escapeHtml(s.title) + '</span>' +
            '  <span class="score-row-meta">Updated ' + s.updated + '</span>' +
            '</a></li>'
        ).join('') + '</ul>';
    }

    function attachSearch() {
        const $search = document.getElementById('score-search');
        const $list = document.getElementById('score-list-host');
        const $count = document.getElementById('score-count');
        if (!$search || !$list) return;
        const update = () => {
            $list.innerHTML = renderRows($search.value);
            const q = $search.value.trim().toLowerCase();
            const shown = q ? allScores.filter(s => s.title.toLowerCase().includes(q)).length : allScores.length;
            if ($count) {
                $count.textContent = shown === allScores.length
                    ? allScores.length + ' score' + (allScores.length === 1 ? '' : 's')
                    : shown + ' of ' + allScores.length;
            }
        };
        $search.addEventListener('input', update);
        update();
    }

    async function load() {
        try {
            const gists = await GistAPI.listMine(CONFIG.githubUser);
            if (!gists.length) {
                $content.innerHTML =
                    '<div class="empty-state">' +
                    '  <h3>No scores yet</h3>' +
                    '  <p>Once you publish your first score from the editor, it’ll appear here.</p>' +
                    '  <a href="/music/edit.html" class="btn btn-primary">Open editor</a>' +
                    '</div>';
                return;
            }
            allScores = gists.map(g => ({
                title: GistAPI.titleOf(g),
                updated: relativeTime(g.updated_at),
                viewerUrl: '/music/view.html?id=' + encodeURIComponent(g.id)
            }));
            $content.innerHTML =
                '<div class="score-toolbar">' +
                '  <input type="search" id="score-search" placeholder="Search scores by title…" autocomplete="off" autofocus>' +
                '  <span class="score-count" id="score-count"></span>' +
                '</div>' +
                '<div id="score-list-host"></div>';
            attachSearch();
        } catch (err) {
            console.error(err);
            $content.innerHTML =
                '<div class="empty-state">' +
                '  <h3>Could not load library</h3>' +
                '  <p>' + escapeHtml(err.message) + '</p>' +
                '</div>';
        }
    }

    load();
})();
