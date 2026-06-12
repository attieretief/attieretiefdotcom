// music/app.js — editor application logic
(function () {
    'use strict';

    const { Auth, GistAPI, AbcUtil, MP3Export, Toast, CONFIG } = window.AbcMusic;

    // DOM refs
    const $input       = document.getElementById('abc-input');
    const $score       = document.getElementById('score-render');
    const $lineCount   = document.getElementById('line-count');
    const $renderStat  = document.getElementById('render-status');
    const $status      = document.getElementById('status');
    const $btnNew      = document.getElementById('btn-new');
    const $btnPublish  = document.getElementById('btn-publish');
    const $btnPlay     = document.getElementById('btn-play');
    const $btnStop     = document.getElementById('btn-stop');
    const $btnMp3      = document.getElementById('btn-mp3');
    const $mp3Label    = document.getElementById('mp3-label');
    const $collection  = document.getElementById('collection');
    const $transpose   = document.getElementById('transpose');
    const $transValue  = document.getElementById('transpose-value');
    const $modalRoot   = document.getElementById('modal-root');
    const $publishLabel    = document.getElementById('publish-label');
    const $editingIndicator = document.getElementById('editing-indicator');
    const $editingTitle     = document.getElementById('editing-title');

    // State
    let visualObj = null;
    let synthControl = null;
    let audioContext = null;
    let isPlaying = false;
    let currentGistId = null;     // null = not yet published; string = update existing
    let currentTitle = '';
    let renderTimer = null;

    function showTokenModal(then) {
        const html =
            '<div class="modal-backdrop" id="token-modal">' +
            '  <div class="modal">' +
            '    <h2>GitHub token needed</h2>' +
            '    <p>Publishing creates a public Gist on your GitHub account. Paste a Personal Access Token with the <code>gist</code> scope. It’s stored locally in this browser.</p>' +
            '    <label for="tok">GitHub PAT</label>' +
            '    <input type="password" id="tok" placeholder="ghp_…" autocomplete="off" autofocus>' +
            '    <div class="modal-help">' +
            '      Create one at <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">github.com/settings/tokens</a> with only the <code>gist</code> permission. It never leaves your browser.' +
            '    </div>' +
            '    <div class="modal-actions">' +
            '      <button class="btn" id="tok-cancel">Cancel</button>' +
            '      <button class="btn btn-primary" id="tok-save">Save token</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        $modalRoot.innerHTML = html;
        const $tok = document.getElementById('tok');
        document.getElementById('tok-cancel').addEventListener('click', () => { $modalRoot.innerHTML = ''; });
        const submit = () => {
            const t = $tok.value.trim();
            if (!t) return;
            Auth.setToken(t);
            $modalRoot.innerHTML = '';
            then();
        };
        document.getElementById('tok-save').addEventListener('click', submit);
        $tok.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    }

    // ============================================================
    // Wire up the app
    // ============================================================
    function init() {
        const params = new URLSearchParams(location.search);
        const gistId = params.get('id');
        const isNew = params.has('new');

        if (isNew) {
            // Explicit fresh start — ignore any cached draft and clean the URL.
            $input.value = AbcUtil.starter;
            localStorage.removeItem(CONFIG.storageKeys.draft);
            const url = new URL(location.href);
            url.searchParams.delete('new');
            history.replaceState({}, '', url);
        } else {
            // Default: restore draft (so accidental tab-close doesn't lose work)
            const draft = localStorage.getItem(CONFIG.storageKeys.draft);
            $input.value = draft || AbcUtil.starter;
        }

        if (gistId) {
            loadFromGist(gistId);
        } else {
            scheduleRender();
        }

        // Editor input → debounced re-render + save draft
        $input.addEventListener('input', () => {
            localStorage.setItem(CONFIG.storageKeys.draft, $input.value);
            updateLineCount();
            scheduleRender();
        });
        updateLineCount();

        // Transpose — live preview during drag (visualTranspose, no source edit),
        // then on release rewrite the ABC source so what's published matches what's shown.
        $transpose.addEventListener('input', () => {
            const v = parseInt($transpose.value, 10);
            $transValue.textContent = (v > 0 ? '+' : '') + v;
            scheduleRender();
        });
        $transpose.addEventListener('change', () => {
            const steps = parseInt($transpose.value, 10);
            if (!steps || !visualObj || !ABCJS || typeof ABCJS.strTranspose !== 'function') return;
            let transposed;
            try {
                transposed = ABCJS.strTranspose($input.value, [visualObj], steps);
            } catch (err) {
                console.error('Transpose failed:', err);
                Toast.error('Could not transpose');
                return;
            }
            $input.value = transposed;
            localStorage.setItem(CONFIG.storageKeys.draft, transposed);
            updateLineCount();
            $transpose.value = '0';
            $transValue.textContent = '0';
            render();
        });

        // Buttons
        $btnNew.addEventListener('click', newScore);
        $btnPublish.addEventListener('click', publish);
        $btnPlay.addEventListener('click', togglePlay);
        $btnStop.addEventListener('click', stopPlay);
        $btnMp3.addEventListener('click', downloadMp3);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl-S → publish
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                publish();
            }
            // Space (when not in textarea) → play/pause
            if (e.code === 'Space' && document.activeElement !== $input) {
                e.preventDefault();
                togglePlay();
            }
        });
    }

    // ============================================================
    // Render
    // ============================================================
    function scheduleRender() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(render, 200);
    }

    function render() {
        if (typeof ABCJS === 'undefined') {
            $renderStat.textContent = 'Loading…';
            setTimeout(render, 250);
            return;
        }
        try {
            const transposeBy = parseInt($transpose.value || '0', 10);
            const result = ABCJS.renderAbc($score, $input.value, {
                responsive: 'resize',
                add_classes: true,
                visualTranspose: transposeBy,
                staffwidth: 720,
                paddingtop: 8,
                paddingbottom: 8,
                paddingleft: 0,
                paddingright: 0,
                format: { titlefont: '"Helvetica Neue" 18 bold', subtitlefont: '"Helvetica Neue" 13 italic' }
            });
            visualObj = result && result[0];
            $renderStat.textContent = visualObj ? 'OK' : 'Empty';
            // Reset synth — needs new visualObj. Full teardown stops any in-flight audio.
            tearDownSynth();
            currentTitle = AbcUtil.extractTitle($input.value);
            updatePublishUI();
        } catch (err) {
            $renderStat.textContent = 'Parse error';
            console.error(err);
        }
    }

    // ============================================================
    // Publish/Update state UI
    // ============================================================
    function updatePublishUI() {
        if (currentGistId) {
            $publishLabel.textContent = 'Update';
            $btnPublish.title = 'Update the published score';
            $editingTitle.textContent = currentTitle || 'Untitled';
            $editingIndicator.hidden = false;
        } else {
            $publishLabel.textContent = 'Publish';
            $btnPublish.title = 'Publish this score as a new gist';
            $editingIndicator.hidden = true;
        }
    }

    function showConfirmUpdateModal(title, onConfirm) {
        const html =
            '<div class="modal-backdrop" id="confirm-modal">' +
            '  <div class="modal">' +
            '    <h2>Update published score?</h2>' +
            '    <p>This will overwrite <strong>' + escapeHtml(title || 'Untitled') + '</strong> on GitHub. Anyone viewing the shared link will see the new version.</p>' +
            '    <p class="modal-help">If you meant to start a fresh score instead, cancel and click <strong>New</strong>.</p>' +
            '    <div class="modal-actions">' +
            '      <button class="btn" id="confirm-cancel">Cancel</button>' +
            '      <button class="btn btn-primary" id="confirm-go">Update</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        $modalRoot.innerHTML = html;
        const close = () => { $modalRoot.innerHTML = ''; };
        document.getElementById('confirm-cancel').addEventListener('click', close);
        document.getElementById('confirm-go').addEventListener('click', () => { close(); onConfirm(); });
        document.getElementById('confirm-modal').addEventListener('click', e => {
            if (e.target.id === 'confirm-modal') close();
        });
    }

    function updateLineCount() {
        const n = ($input.value.match(/\n/g) || []).length + 1;
        $lineCount.textContent = n + ' line' + (n === 1 ? '' : 's');
    }

    // ============================================================
    // Playback — abcjs synth with cursor following
    // ============================================================
    function highlightLyricUnder(noteEl) {
        // Match lyrics geometrically (abcjs doesn't link lyrics to notes via classes),
        // but scope the search to the note's own system group (abcjs-l<n>) so columns
        // with the same x in other systems don't get caught.
        if (!noteEl.getBBox) return;
        let scope = noteEl.parentElement;
        while (scope && (!scope.classList || !Array.from(scope.classList).some(c => /^abcjs-l\d+$/.test(c)))) {
            scope = scope.parentElement;
        }
        if (!scope || !scope.querySelectorAll) scope = noteEl.ownerSVGElement;
        if (!scope) return;
        let nb;
        try { nb = noteEl.getBBox(); } catch (e) { return; }
        const left = nb.x - 4;
        const right = nb.x + nb.width + 4;
        scope.querySelectorAll('.abcjs-lyric').forEach(lyric => {
            try {
                const lb = lyric.getBBox();
                const cx = lb.x + lb.width / 2;
                if (cx >= left && cx <= right) lyric.classList.add('abcjs-highlight');
            } catch (e) {}
        });
    }

    async function ensureSynth() {
        if (synthControl) return synthControl;
        if (!visualObj) { Toast.error('Nothing to play yet'); return null; }
        if (!ABCJS.synth.supportsAudio()) { throw new Error('This browser does not support Web Audio'); }

        // Host element must exist BEFORE synthControl.load() — it queries the selector.
        if (!document.getElementById('synth-host')) {
            const h = document.createElement('div');
            h.id = 'synth-host';
            h.style.display = 'none';
            document.body.appendChild(h);
        }

        // Reuse a single AudioContext for the page; recreate if abcjs closed it
        // as a side effect of disable(true). A closed context plays silently.
        if (!audioContext || audioContext.state === 'closed') {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            audioContext = new Ctx();
        }
        if (audioContext.state === 'suspended') await audioContext.resume();

        // Cursor control — highlights the playing note. abcjs wires it up via load().
        const cursorControl = {
            onStart: function () {},
            onFinished: function () {
                document.querySelectorAll('.abcjs-highlight').forEach(el => el.classList.remove('abcjs-highlight'));
                isPlaying = false; updatePlayBtn(); $status.textContent = 'Done';
            },
            onBeat: function () {},
            onEvent: function (ev) {
                if (ev.measureStart && ev.left === null) return;
                document.querySelectorAll('.abcjs-highlight').forEach(el => el.classList.remove('abcjs-highlight'));
                if (ev.elements) {
                    ev.elements.forEach(group => group.forEach(el => {
                        el.classList.add('abcjs-highlight');
                        highlightLyricUnder(el);
                    }));
                }
            }
        };

        synthControl = new ABCJS.synth.SynthController();
        synthControl.load('#synth-host', cursorControl, {
            displayLoop: false,
            displayRestart: false,
            displayPlay: false,
            displayProgress: true,
            displayWarp: false
        });

        await synthControl.setTune(visualObj, false, {
            chordsOff: false,
            audioContext: audioContext,
            soundFontUrl: 'https://paulrosen.github.io/midi-js-soundfonts/abcjs/'
        });

        return synthControl;
    }

    async function togglePlay() {
        if (isPlaying) {
            if (synthControl) synthControl.pause();
            isPlaying = false;
            updatePlayBtn();
            $status.textContent = 'Paused';
            return;
        }
        $status.textContent = 'Loading sound…';
        try {
            const sc = await ensureSynth();
            if (!sc) { $status.textContent = 'Ready'; return; }
            sc.play();
            isPlaying = true;
            updatePlayBtn();
            $status.textContent = 'Playing';
        } catch (err) {
            console.error(err);
            $status.textContent = 'Audio failed';
            Toast.error('Could not start playback');
        }
    }

    function tearDownSynth() {
        if (!synthControl) return;
        // Don't call disable(true) — it closes the shared AudioContext, leaving the
        // next play silent (sc.play() succeeds into a dead context).
        try { synthControl.pause(); } catch (e) {}
        try { synthControl.restart(); } catch (e) {}
        synthControl = null;
        isPlaying = false;
        updatePlayBtn();
        document.querySelectorAll('.abcjs-highlight').forEach(el => el.classList.remove('abcjs-highlight'));
    }

    function stopPlay() {
        tearDownSynth();
        $status.textContent = 'Stopped';
    }

    function updatePlayBtn() {
        $btnPlay.innerHTML = isPlaying
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    }

    // ============================================================
    // MP3 export
    // ============================================================
    async function downloadMp3() {
        if (!visualObj) { Toast.error('Nothing to export'); return; }
        $btnMp3.disabled = true;
        $mp3Label.innerHTML = '<span class="spinner"></span> Rendering…';
        $status.textContent = 'Rendering MP3…';
        try {
            const blob = await MP3Export.render(visualObj, {
                onProgress: (p) => {
                    $status.textContent = 'Encoding ' + Math.round(p * 100) + '%';
                }
            });
            const filename = (currentTitle || 'score').replace(/[^a-z0-9]+/gi, '_') + '.mp3';
            MP3Export.downloadBlob(blob, filename);
            Toast.success('Downloaded ' + filename);
            $status.textContent = 'MP3 ready';
        } catch (err) {
            console.error(err);
            Toast.error('MP3 export failed: ' + err.message);
            $status.textContent = 'MP3 failed';
        } finally {
            $btnMp3.disabled = false;
            $mp3Label.textContent = 'MP3';
        }
    }

    // ============================================================
    // Save / publish
    // ============================================================
    function publish() {
        const abc = $input.value;
        const title = AbcUtil.extractTitle(abc);
        const token = Auth.getToken();
        const tag = $collection ? $collection.value : undefined;
        if (!token) {
            showTokenModal(() => publish());
            return;
        }
        if (currentGistId) {
            showConfirmUpdateModal(title, () => doPublish(abc, title, token, tag));
        } else {
            doPublish(abc, title, token, tag);
        }
    }

    async function doPublish(abc, title, token, tag) {
        $btnPublish.disabled = true;
        const orig = $btnPublish.innerHTML;
        $btnPublish.innerHTML = '<span class="spinner"></span> ' + (currentGistId ? 'Updating…' : 'Publishing…');
        try {
            let gist;
            if (currentGistId) {
                gist = await GistAPI.update(currentGistId, title, abc, token, tag);
                Toast.success('Updated');
            } else {
                gist = await GistAPI.create(title, abc, token, tag);
                currentGistId = gist.id;
                localStorage.setItem(CONFIG.storageKeys.lastId, gist.id);
                // Update URL without reloading
                const url = new URL(location.href);
                url.searchParams.set('id', gist.id);
                history.replaceState({}, '', url);
                Toast.success('Published');
            }
            updatePublishUI();
            // Show share link
            showShareModal(gist.id, title);
        } catch (err) {
            console.error(err);
            if (/401|403/.test(err.message)) {
                Toast.error('Token rejected — re-enter');
                Auth.setToken('');
                showTokenModal(() => publish());
            } else {
                Toast.error('Publish failed: ' + err.message);
            }
        } finally {
            $btnPublish.disabled = false;
            $btnPublish.innerHTML = orig;
        }
    }

    function showShareModal(id, title) {
        const url = location.origin + '/music/view.html?id=' + encodeURIComponent(id);
        const html =
            '<div class="modal-backdrop" id="share-modal">' +
            '  <div class="modal">' +
            '    <h2>Published</h2>' +
            '    <p><strong>' + escapeHtml(title) + '</strong> is now live. Share this link:</p>' +
            '    <input type="text" id="share-url" readonly value="' + escapeHtml(url) + '">' +
            '    <div class="modal-actions">' +
            '      <button class="btn" id="share-open">Open viewer</button>' +
            '      <button class="btn btn-primary" id="share-copy">Copy link</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        $modalRoot.innerHTML = html;
        const $url = document.getElementById('share-url');
        $url.addEventListener('focus', () => $url.select());
        document.getElementById('share-open').addEventListener('click', () => { window.open(url, '_blank'); });
        document.getElementById('share-copy').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(url);
                Toast.success('Copied to clipboard');
                $modalRoot.innerHTML = '';
            } catch (e) {
                $url.select();
                document.execCommand('copy');
                Toast.success('Copied');
                $modalRoot.innerHTML = '';
            }
        });
        // Close on backdrop click
        document.getElementById('share-modal').addEventListener('click', (e) => {
            if (e.target.id === 'share-modal') $modalRoot.innerHTML = '';
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }

    // ============================================================
    // Load existing gist
    // ============================================================
    async function loadFromGist(id) {
        $renderStat.textContent = 'Loading…';
        try {
            const gist = await GistAPI.read(id);
            const abc = GistAPI.abcOf(gist);
            $input.value = abc;
            if ($collection) $collection.value = GistAPI.tagOf(gist);
            currentGistId = id;
            localStorage.setItem(CONFIG.storageKeys.draft, abc);
            updateLineCount();
            render();
            Toast.success('Loaded ' + GistAPI.titleOf(gist));
        } catch (err) {
            Toast.error('Could not load: ' + err.message);
            scheduleRender();
        }
    }

    // ============================================================
    // New score
    // ============================================================
    function newScore() {
        if ($input.value.trim() && !confirm('Discard current score and start fresh?')) return;
        $input.value = AbcUtil.starter;
        currentGistId = null;
        localStorage.setItem(CONFIG.storageKeys.draft, $input.value);
        const url = new URL(location.href);
        url.searchParams.delete('id');
        history.replaceState({}, '', url);
        updateLineCount();
        render();
        $input.focus();
    }

    // ============================================================
    // Boot
    // ============================================================
    init();
})();
