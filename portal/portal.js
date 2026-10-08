/* =====================================================================
   ARCADE 2.0 — Portal Logic
   Fetches games.json, renders hero + grid, handles search + categories,
   opens games in an iframe modal, tears down cleanly on close.
   ===================================================================== */

'use strict';

(function () {

    // ==================== STATE ====================
    let gamesData = null;
    let activeCategory = 'All';
    let searchQuery = '';
    let modalOpen = false;
    let currentIframe = null;

    // ==================== DOM REFS ====================
    const dom = {
        navLogo:         document.getElementById('navLogo'),
        searchInput:     document.getElementById('searchInput'),
        categoryTabs:    document.getElementById('categoryTabs'),
        hero:            document.getElementById('hero'),
        gridTitle:       document.getElementById('gridTitle'),
        gridCount:       document.getElementById('gridCount'),
        gameGrid:        document.getElementById('gameGrid'),
        emptyState:      document.getElementById('emptyState'),
        modal:           document.getElementById('gameModal'),
        modalBackdrop:   document.getElementById('modalBackdrop'),
        modalTitle:      document.getElementById('modalTitle'),
        modalSubtitle:   document.getElementById('modalSubtitle'),
        modalBody:       document.getElementById('modalBody'),
        modalClose:      document.getElementById('modalClose'),
        modalFullscreen: document.getElementById('modalFullscreen')
    };

    // ==================== BOOT ====================
    async function init() {
        try {
            const res = await fetch('/portal/games.json', { cache: 'no-store' });
            if (!res.ok) throw new Error('games.json failed: ' + res.status);
            gamesData = await res.json();
        } catch (err) {
            console.error('Portal init failed:', err);
            dom.gameGrid.innerHTML = '<p style="color:#ef4444;padding:40px">Failed to load games.json</p>';
            return;
        }

        renderCategories();
        renderHero();
        renderGrid();
        wireUpEvents();

        console.log('✅ Portal ready —', gamesData.games.length, 'games loaded');
    }

    // ==================== CATEGORIES ====================
    function renderCategories() {
        const cats = gamesData.categories || ['All'];
        dom.categoryTabs.innerHTML = '';

        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'cat-tab' + (cat === activeCategory ? ' active' : '');
            btn.textContent = cat;
            btn.dataset.category = cat;
            btn.addEventListener('click', () => {
                activeCategory = cat;
                updateActiveCategory();
                renderGrid();
            });
            dom.categoryTabs.appendChild(btn);
        });
    }

    function updateActiveCategory() {
        dom.categoryTabs.querySelectorAll('.cat-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === activeCategory);
        });
    }

    // ==================== HERO ====================
    function renderHero() {
        const featured = gamesData.games.find(g => g.featured && g.status === 'live');

        if (!featured) {
            dom.hero.style.display = 'none';
            return;
        }

        dom.hero.style.display = '';
        dom.hero.innerHTML = '';

        const content = document.createElement('div');
        content.className = 'hero-content';

        const tag = document.createElement('span');
        tag.className = 'hero-tag';
        tag.textContent = 'Featured';

        const title = document.createElement('h1');
        title.className = 'hero-title';
        title.textContent = featured.title;

        const desc = document.createElement('p');
        desc.className = 'hero-desc';
        desc.textContent = featured.description || '';

        const tags = document.createElement('div');
        tags.className = 'hero-tags';
        (featured.tags || []).forEach(t => {
            const chip = document.createElement('span');
            chip.className = 'card-badge';
            chip.textContent = t;
            tags.appendChild(chip);
        });

        const cta = document.createElement('button');
        cta.className = 'hero-cta';
        cta.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>
            Play Now
        `;
        cta.addEventListener('click', () => openGame(featured.id));

        content.appendChild(tag);
        content.appendChild(title);
        content.appendChild(desc);
        content.appendChild(tags);
        content.appendChild(cta);

        const art = document.createElement('div');
        art.className = 'hero-art';
        if (featured.thumbnail) {
            const img = document.createElement('img');
            img.src = featured.thumbnail;
            img.alt = featured.title;
            img.loading = 'lazy';
            img.onerror = () => { img.style.display = 'none'; };
            art.appendChild(img);
        }

        dom.hero.appendChild(content);
        dom.hero.appendChild(art);
    }

    // ==================== GRID ====================
    function renderGrid() {
        const filtered = filterGames();
        dom.gameGrid.innerHTML = '';

        dom.gridTitle.textContent = activeCategory === 'All' ? 'All Games' : activeCategory;
        dom.gridCount.textContent = filtered.length + (filtered.length === 1 ? ' game' : ' games');

        if (filtered.length === 0) {
            dom.emptyState.style.display = '';
            return;
        }
        dom.emptyState.style.display = 'none';

        filtered.forEach(game => {
            dom.gameGrid.appendChild(buildCard(game));
        });
    }

    function filterGames() {
        return gamesData.games.filter(g => {
            const matchesCat = activeCategory === 'All' || g.category === activeCategory;
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q ||
                g.title.toLowerCase().includes(q) ||
                (g.description || '').toLowerCase().includes(q) ||
                (g.tags || []).some(t => t.toLowerCase().includes(q));
            return matchesCat && matchesSearch;
        });
    }

    function buildCard(game) {
        const isComingSoon = game.status === 'coming-soon';
        const card = document.createElement('div');
        card.className = 'card' + (isComingSoon ? ' coming-soon' : '');
        card.dataset.id = game.id;

        const thumb = document.createElement('div');
        thumb.className = 'card-thumb';

        if (game.thumbnail) {
            const img = document.createElement('img');
            img.src = game.thumbnail;
            img.alt = game.title;
            img.loading = 'lazy';
            img.onerror = () => {
                img.remove();
                const fallback = document.createElement('span');
                fallback.className = 'thumb-fallback';
                fallback.textContent = game.title.slice(0, 3).toUpperCase();
                thumb.appendChild(fallback);
            };
            thumb.appendChild(img);
        } else {
            const fallback = document.createElement('span');
            fallback.className = 'thumb-fallback';
            fallback.textContent = game.title.slice(0, 3).toUpperCase();
            thumb.appendChild(fallback);
        }

        if (!isComingSoon) {
            const play = document.createElement('div');
            play.className = 'card-play';
            play.innerHTML = `
                <div class="card-play-inner">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6 4 20 12 6 20 6 4"></polygon>
                    </svg>
                </div>
            `;
            thumb.appendChild(play);
        }

        const body = document.createElement('div');
        body.className = 'card-body';

        const title = document.createElement('h3');
        title.className = 'card-title';
        title.textContent = game.title;

        const desc = document.createElement('p');
        desc.className = 'card-desc';
        desc.textContent = game.description || '';

        const meta = document.createElement('div');
        meta.className = 'card-meta';

        const cat = document.createElement('span');
        cat.className = 'card-category';
        cat.textContent = game.category || '';

        meta.appendChild(cat);

        if (isComingSoon) {
            const badge = document.createElement('span');
            badge.className = 'card-badge';
            badge.textContent = 'Soon';
            meta.appendChild(badge);
        }

        body.appendChild(title);
        body.appendChild(desc);
        body.appendChild(meta);

        card.appendChild(thumb);
        card.appendChild(body);

        if (!isComingSoon) {
            card.addEventListener('click', () => openGame(game.id));
        }

        return card;
    }

    // ==================== MODAL ====================
    function openGame(gameId) {
        const game = gamesData.games.find(g => g.id === gameId);
        if (!game || game.status !== 'live' || !game.path) return;

        dom.modalTitle.textContent = game.title;
        dom.modalSubtitle.textContent = game.category || '';

        const iframe = document.createElement('iframe');
        iframe.src = game.path;
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('allow', 'fullscreen; gamepad');
        iframe.title = game.title;

        dom.modalBody.innerHTML = '';
        dom.modalBody.appendChild(iframe);
        currentIframe = iframe;

        dom.modal.style.display = 'flex';
        modalOpen = true;

        document.body.style.overflow = 'hidden';

        try { history.replaceState(null, '', '#game=' + gameId); } catch (e) {}
    }

    function closeGame() {
        if (!modalOpen) return;

        if (currentIframe && currentIframe.contentWindow) {
            try {
                currentIframe.contentWindow.postMessage({ type: 'arcade-destroy' }, '*');
            } catch (e) {}
        }

        dom.modalBody.innerHTML = '';
        currentIframe = null;

        dom.modal.style.display = 'none';
        modalOpen = false;
        document.body.style.overflow = '';

        try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
    }

    // ==================== EVENTS ====================
    function wireUpEvents() {
        dom.searchInput.addEventListener('input', e => {
            searchQuery = e.target.value;
            renderGrid();
        });

        dom.modalClose.addEventListener('click', closeGame);
        dom.modalBackdrop.addEventListener('click', closeGame);

        dom.modalFullscreen.addEventListener('click', () => {
            const shell = dom.modal.querySelector('.modal-shell');
            if (!document.fullscreenElement) {
                shell.requestFullscreen?.().catch(() => {});
            } else {
                document.exitFullscreen?.();
            }
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modalOpen) closeGame();
            if (e.key === '/' && !modalOpen && document.activeElement !== dom.searchInput) {
                e.preventDefault();
                dom.searchInput.focus();
            }
        });

        dom.navLogo.addEventListener('click', e => {
            e.preventDefault();
            searchQuery = '';
            dom.searchInput.value = '';
            activeCategory = 'All';
            updateActiveCategory();
            renderGrid();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        window.addEventListener('message', e => {
            if (!e.data || typeof e.data !== 'object') return;
            if (e.data.type === 'arcade-close') closeGame();
        });

        window.addEventListener('hashchange', handleHash);

        if (window.location.hash.startsWith('#game=')) {
            const id = window.location.hash.slice(6);
            setTimeout(() => openGame(id), 100);
        }
    }

    function handleHash() {
        const h = window.location.hash;
        if (h.startsWith('#game=')) {
            openGame(h.slice(6));
        } else if (modalOpen) {
            closeGame();
        }
    }

    // ==================== GO ====================
    init();

})();