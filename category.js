/* ============================================
   Category Page - App Management JS
   ============================================ */

(() => {
    'use strict';

    // ---------- Auth Check ----------
    const AUTH_KEY = 'lp_authenticated';
    const AUTH_CATS_KEY = 'lp_auth_cats';
    if (localStorage.getItem(AUTH_KEY) !== 'true') {
        window.location.href = 'index.html';
        return;
    }
    // Role-based category access check
    const urlCatId = new URLSearchParams(window.location.search).get('cat') || '';
    const allowedCats = localStorage.getItem(AUTH_CATS_KEY);
    if (allowedCats && allowedCats !== '*') {
        const cats = JSON.parse(allowedCats);
        if (!cats.includes(urlCatId)) {
            alert('このカテゴリへのアクセス権限がありません');
            window.location.href = 'index.html';
            return;
        }
    }

    // ---------- Local Check ----------
    const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:';

    // ---------- Category Metadata ----------
    const CATEGORY_META = {
        counter: { title: 'カウンターツール', icon: '🔢', description: '生徒数カウント・出席管理など' },
        learning: { title: '学習アプリ', icon: '📚', description: '教科学習・テスト対策アプリ' },
        accounting: { title: '経理ツール', icon: '💼', description: '月謝管理・会計処理ツール' },
        mini: { title: 'ミニアプリ', icon: '⚡', description: '便利な小型ユーティリティ' },
        database: { title: 'データベース', icon: '🗄️', description: 'データ管理・検索・分析ツール' },
        event: { title: 'イベント管理', icon: '📅', description: '行事・説明会・参加者管理ツール' }
    };

    // ---------- Get Category from URL ----------
    const params = new URLSearchParams(window.location.search);
    const catId = params.get('cat') || 'counter';
    const storageKey = `lp_cat_${catId}_apps`;
    const isLearning = catId === 'learning';
    const LEARNING_GROUPS = new Map([
        ['all', 'すべて'],
        ['eiken', '英検'],
        ['high-school', '高校生用'],
        ['junior-high', '中学生用'],
        ['other', 'その他']
    ]);

    // ---------- Image Config ----------
    const MAX_IMG_WIDTH = 480;
    const IMG_QUALITY = 0.7;

    // ---------- State ----------
    let apps = [];
    let editingAppId = null;
    let currentImageData = null;
    let contextMenuTarget = null;
    let currentTags = [];
    let searchQuery = '';
    let activeFilterTags = [];
    let activeLearningGroup = 'all';
    let gridRenderVersion = 0;
    const tagsStorageKey = `lp_cat_${catId}_registered_tags`;

    // ---------- DOM Elements ----------
    const catTitle = document.getElementById('catTitle');
    const catIcon = document.getElementById('catIcon');
    const catName = document.getElementById('catName');
    const catDescription = document.getElementById('catDescription');
    const grid = document.getElementById('appGrid');
    const modal = document.getElementById('appModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('appForm');
    const inputName = document.getElementById('inputAppName');
    const inputUrl = document.getElementById('inputAppUrl');
    const inputCaption = document.getElementById('inputAppCaption');
    const inputImage = document.getElementById('inputAppImage');
    const uploadArea = document.getElementById('imageUploadArea');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const uploadPreview = document.getElementById('uploadPreview');
    const btnCancel = document.getElementById('btnCancel');
    const contextMenu = document.getElementById('contextMenu');
    const toastContainer = document.getElementById('toastContainer');
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const tagFilterBar = document.getElementById('tagFilterBar');
    const learningTabs = document.getElementById('learningTabs');
    const inputLearningGroup = document.getElementById('inputLearningGroup');
    const tagListEl = document.getElementById('tagList');
    const inputTag = document.getElementById('inputTag');
    const btnAddTag = document.getElementById('btnAddTag');
    const tagSuggestions = document.getElementById('tagSuggestions');

    // ---------- Set Category Info ----------
    function setCategoryInfo() {
        let meta = CATEGORY_META[catId];
        if (!meta) {
            const stored = localStorage.getItem('lp_categories');
            if (stored) {
                const cats = JSON.parse(stored);
                const found = cats.find(c => c.id === catId);
                if (found) {
                    meta = { title: found.title, icon: found.icon, description: found.description };
                }
            }
        }
        if (!meta) {
            meta = { title: catId, icon: '📁', description: '' };
        }
        catIcon.textContent = meta.icon;
        catName.textContent = meta.title;
        catDescription.textContent = `── ${meta.description} ──`;
        document.title = `${meta.title} - ECCベストワン Webアプリランチャー`;
    }

    // =============================================
    //  IndexedDB - images stored here (no size limit)
    // =============================================
    const DB_NAME = 'lp_images_db';
    const DB_VERSION = 1;
    const STORE_NAME = 'images';
    let db = null;

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(STORE_NAME)) {
                    req.result.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = () => { db = req.result; resolve(db); };
            req.onerror = () => reject(req.error);
        });
    }

    function idbSave(key, val) {
        return new Promise((resolve, reject) => {
            if (!db) { resolve(); return; }
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(val, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbLoad(key) {
        return new Promise((resolve) => {
            if (!db) { resolve(null); return; }
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    function idbDelete(key) {
        return new Promise((resolve) => {
            if (!db) { resolve(); return; }
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    }

    // =============================================
    //  localStorage - metadata only (no images)
    // =============================================
    function loadApps() {
        const stored = localStorage.getItem(storageKey);
        apps = stored ? JSON.parse(stored) : [];
    }

    function saveApps() {
        try {
            const toSave = apps.map(a => {
                const copy = { ...a };
                delete copy.image; // never save image to localStorage
                return copy;
            });
            localStorage.setItem(storageKey, JSON.stringify(toSave));
        } catch (e) {
            showToast('⚠️ 保存に失敗しました');
            console.error('save error:', e);
        }
    }

    // Migrate: move any leftover images from localStorage to IndexedDB
    async function migrateToIDB() {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        let migrated = 0;
        for (const app of parsed) {
            if (app.image && app.image.startsWith('data:')) {
                await idbSave(app.id, app.image);
                app._hasImage = true;
                delete app.image;
                migrated++;
            }
        }
        if (migrated > 0) {
            localStorage.setItem(storageKey, JSON.stringify(parsed));
            apps = parsed;
            showToast(`${migrated}件の画像データを移行しました`);
        }
    }

    // ---------- Registered Tags ----------
    function getRegisteredTags() {
        const s = localStorage.getItem(tagsStorageKey);
        return s ? JSON.parse(s) : [];
    }
    function saveRegisteredTags(tags) { localStorage.setItem(tagsStorageKey, JSON.stringify(tags)); }
    function registerTag(tag) {
        const tags = getRegisteredTags();
        if (!tags.includes(tag)) { tags.push(tag); tags.sort(); saveRegisteredTags(tags); }
    }
    function getAllUsedTags() {
        const s = new Set(getRegisteredTags());
        apps.forEach(a => { if (a.tags) a.tags.forEach(t => s.add(t)); });
        return [...s].sort();
    }

    // ---------- Learning Tabs ----------
    function getLearningGroup(app) {
        if (app.learningGroup !== 'all' && LEARNING_GROUPS.has(app.learningGroup)) {
            return app.learningGroup;
        }
        const tags = app.tags || [];
        const name = app.name || '';
        const highSchool = tags.includes('高校生') || tags.includes('大学受験');
        const juniorHigh = tags.some(tag => ['中学生', '高校受験', '基礎学'].includes(tag));
        if (/未就学|小学(生|高学年)/.test(name)) return 'other';
        if (tags.includes('大学受験') && tags.includes('高校受験')) return 'other';
        if (tags.includes('英検') || name.includes('英検')) return 'eiken';
        if (highSchool && juniorHigh) return 'other';
        if (highSchool || /大学.*英語|私立大英語|共通テスト/.test(name)) return 'high-school';
        if (juniorHigh || /中学|高校入試|基礎学/.test(name)) return 'junior-high';
        return 'other';
    }

    function getAppsInTab() {
        if (!isLearning || activeLearningGroup === 'all') return apps;
        return apps.filter(app => app.type !== 'spacer' && getLearningGroup(app) === activeLearningGroup);
    }

    function initLearningTabs() {
        for (const [group, label] of LEARNING_GROUPS) {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.id = `learning-tab-${group}`;
            tab.className = 'learning-tab';
            tab.dataset.group = group;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', grid.id);
            tab.textContent = label;
            const count = document.createElement('span');
            count.className = 'learning-tab-count';
            tab.appendChild(count);
            tab.addEventListener('click', () => {
                if (group === activeLearningGroup) return;
                activeLearningGroup = group;
                activeFilterTags = [];
                renderTagFilterBar();
                renderGrid();
            });
            learningTabs.appendChild(tab);
            if (group !== 'all') inputLearningGroup.add(new Option(label, group));
        }

        learningTabs.addEventListener('keydown', event => {
            const tabs = [...learningTabs.children];
            const index = tabs.indexOf(event.target);
            let next;
            switch (event.key) {
                case 'ArrowRight': next = (index + 1) % tabs.length; break;
                case 'ArrowLeft': next = (index - 1 + tabs.length) % tabs.length; break;
                case 'Home': next = 0; break;
                case 'End': next = tabs.length - 1; break;
                default: return;
            }
            event.preventDefault();
            tabs[next].focus();
            tabs[next].click();
        });
        grid.setAttribute('role', 'tabpanel');
        grid.tabIndex = 0;
        learningTabs.hidden = false;
        document.getElementById('learningGroupField').hidden = !isLocal;
    }

    function updateLearningTabs() {
        const counts = { all: 0, eiken: 0, 'high-school': 0, 'junior-high': 0, other: 0 };
        for (const app of apps) {
            if (app.type === 'spacer') continue;
            counts.all++;
            counts[getLearningGroup(app)]++;
        }
        for (const tab of learningTabs.children) {
            const { group } = tab.dataset;
            const active = group === activeLearningGroup;
            tab.setAttribute('aria-selected', String(active));
            tab.setAttribute('aria-label', `${LEARNING_GROUPS.get(group)} ${counts[group]}件`);
            tab.tabIndex = active ? 0 : -1;
            tab.lastElementChild.textContent = counts[group];
            if (active) grid.setAttribute('aria-labelledby', tab.id);
        }
    }

    // ---------- Search / Filter ----------
    function getFilteredApps() {
        let list = getAppsInTab();
        const q = searchQuery.toLowerCase().trim();
        if (q || activeFilterTags.length > 0) {
            list = list.filter(a => a.type !== 'spacer');
        }
        if (q) {
            list = list.filter(a => {
                const n = (a.name || '').toLowerCase();
                const c = (a.caption || '').toLowerCase();
                const t = (a.tags || []).map(x => x.toLowerCase());
                return n.includes(q) || c.includes(q) || t.some(x => x.includes(q));
            });
        }
        if (activeFilterTags.length > 0) {
            list = list.filter(a => activeFilterTags.every(t => (a.tags || []).includes(t)));
        }
        return list;
    }

    function renderTagFilterBar() {
        tagFilterBar.innerHTML = '';
        const tags = isLearning && activeLearningGroup !== 'all'
            ? [...new Set(getAppsInTab().flatMap(app => app.tags || []))].sort()
            : getAllUsedTags();
        if (isLearning) activeFilterTags = activeFilterTags.filter(tag => tags.includes(tag));
        tags.forEach(tag => {
            const btn = document.createElement('button');
            btn.className = 'tag-filter-btn' + (activeFilterTags.includes(tag) ? ' active' : '');
            btn.textContent = tag;
            btn.addEventListener('click', () => {
                const i = activeFilterTags.indexOf(tag);
                if (i >= 0) activeFilterTags.splice(i, 1); else activeFilterTags.push(tag);
                renderTagFilterBar();
                renderGrid();
            });
            tagFilterBar.appendChild(btn);
        });
    }

    // ---------- Render ----------
    function enableDrag(element, itemId) {
        element.draggable = true;
        element.classList.add('sortable');
        element.title = 'ドラッグして並べ替え';

        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', itemId);
            element.classList.add('dragging');
            setTimeout(() => element.style.opacity = '0.4', 0);
        });
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            element.style.opacity = '1';
            document.querySelectorAll('.sortable.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (grid.querySelector('.dragging') !== element) element.classList.add('drag-over');
        });
        element.addEventListener('dragleave', () => element.classList.remove('drag-over'));
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId && draggedId !== itemId) reorderApps(draggedId, itemId);
        });
    }

    async function renderGrid() {
        const version = ++gridRenderVersion;
        if (isLearning) updateLearningTabs();
        grid.innerHTML = '';
        const filtered = getFilteredApps();

        if (filtered.length === 0 && (isLearning || searchQuery || activeFilterTags.length > 0)) {
            const d = document.createElement('div');
            d.className = 'no-results';
            d.textContent = searchQuery.trim() || activeFilterTags.length > 0
                ? '該当するアプリが見つかりません'
                : '登録されているアプリはありません';
            grid.appendChild(d);
        }

        for (let i = 0; i < filtered.length; i++) {
            const app = filtered[i];

            if (app.type === 'spacer') {
                const spacer = document.createElement('div');
                spacer.className = 'app-grid-spacer';
                spacer.dataset.id = app.id;
                if (isLocal) {
                    spacer.classList.add('editable');
                    spacer.innerHTML = `
                      <span class="spacer-label">空白グリッド<br><small>PC表示用</small></span>
                      <button class="spacer-delete-btn" type="button" title="空白グリッドを削除">🗑️</button>`;
                    enableDrag(spacer, app.id);
                    spacer.querySelector('.spacer-delete-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteApp(app.id);
                    });
                }
                grid.appendChild(spacer);
                continue;
            }

            const card = document.createElement('div');
            card.className = 'app-card';
            card.dataset.id = app.id;
            card.style.animationDelay = `${i * 0.08}s`;
            card.style.animation = 'card-fade-in 0.5s ease-out forwards';
            card.style.opacity = '0';
            if (isLocal) {
                enableDrag(card, app.id);
            }

            // Load image from IndexedDB
            let imgSrc = app._hasImage ? await idbLoad(app.id) : null;
            if (version !== gridRenderVersion) return;
            const imageHtml = imgSrc
                ? `<img src="${imgSrc}" alt="${app.name}" loading="lazy" />`
                : `<span class="no-image">📷</span>`;

            const editHtml = isLocal ? `
              <div class="app-card-actions">
                <button class="app-action-btn edit-btn" data-id="${app.id}" title="編集">✏️</button>
                <button class="app-action-btn delete-btn" data-id="${app.id}" title="削除">🗑️</button>
              </div>` : '';

            const tagsHtml = (app.tags && app.tags.length)
                ? `<div class="app-card-tags">${app.tags.map(t => `<span class="tag-badge">${t}</span>`).join('')}</div>` : '';

            card.innerHTML = `
              <div class="app-card-image">${imageHtml}</div>
              <div class="app-card-info">
                <div class="app-card-name">${app.name}</div>
                ${app.caption ? `<div class="app-card-caption">${app.caption}</div>` : ''}
              </div>
              <div class="app-card-launch">🚀</div>
              ${editHtml}${tagsHtml}`;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.app-action-btn')) return;
                if (app.url) window.open(app.url, '_blank');
            });

            if (isLocal) {
                const eb = card.querySelector('.edit-btn');
                const db2 = card.querySelector('.delete-btn');
                if (eb) eb.addEventListener('click', (e) => { e.stopPropagation(); openModal(app.id); });
                if (db2) db2.addEventListener('click', (e) => { e.stopPropagation(); deleteApp(app.id); });
                card.addEventListener('contextmenu', (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, app.id); });

            }
            grid.appendChild(card);
        }

        if (isLocal) {
            const ac = document.createElement('div');
            ac.className = 'add-app-card';
            ac.innerHTML = `<span class="plus-icon">+</span> アプリ追加`;
            ac.addEventListener('click', () => openModal());
            grid.appendChild(ac);

            if (isLearning && activeLearningGroup !== 'all') return;
            const spacerCard = document.createElement('div');
            spacerCard.className = 'add-app-card add-spacer-card';
            spacerCard.innerHTML = `<span class="plus-icon">□</span> 空白グリッド追加 <small>PC表示用</small>`;
            spacerCard.addEventListener('click', addSpacer);
            grid.appendChild(spacerCard);
        }
    }

    // ---------- Card Fade-in Animation ----------
    const styleEl = document.createElement('style');
    styleEl.textContent = `@keyframes card-fade-in{from{opacity:0;transform:translateY(30px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}`;
    document.head.appendChild(styleEl);

    // ---------- Image Handling ----------
    function handleImageFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > MAX_IMG_WIDTH) { h = Math.round(h * MAX_IMG_WIDTH / w); w = MAX_IMG_WIDTH; }
                c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                currentImageData = c.toDataURL('image/jpeg', IMG_QUALITY);
                uploadPreview.src = currentImageData;
                uploadPreview.classList.add('active');
                uploadPlaceholder.style.display = 'none';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // ---------- Modal Tag UI ----------
    function renderModalTags() {
        tagListEl.innerHTML = '';
        currentTags.forEach(tag => {
            const b = document.createElement('span');
            b.className = 'tag-badge';
            b.innerHTML = `${tag} <span class="tag-remove">✕</span>`;
            b.querySelector('.tag-remove').addEventListener('click', () => {
                currentTags = currentTags.filter(t => t !== tag);
                renderModalTags();
            });
            tagListEl.appendChild(b);
        });
    }

    function renderTagSuggestions() {
        tagSuggestions.innerHTML = '';
        getAllUsedTags().forEach(tag => {
            if (currentTags.includes(tag)) return;
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'tag-suggest-btn'; b.textContent = tag;
            b.addEventListener('click', () => {
                if (!currentTags.includes(tag)) { currentTags.push(tag); renderModalTags(); renderTagSuggestions(); }
            });
            tagSuggestions.appendChild(b);
        });
    }

    function addTagFromInput() {
        const v = inputTag.value.trim();
        if (v && !currentTags.includes(v)) { currentTags.push(v); registerTag(v); renderModalTags(); renderTagSuggestions(); }
        inputTag.value = ''; inputTag.focus();
    }

    // ---------- Modal ----------
    async function openModal(appId = null) {
        editingAppId = appId;
        currentImageData = null;
        currentTags = [];
        if (appId) {
            const app = apps.find(a => a.id === appId);
            if (!app) return;
            modalTitle.textContent = 'アプリ編集';
            inputName.value = app.name;
            inputUrl.value = app.url || '';
            inputCaption.value = app.caption || '';
            if (isLearning) inputLearningGroup.value = app.learningGroup || '';
            currentTags = [...(app.tags || [])];
            let imgSrc = app._hasImage ? await idbLoad(app.id) : null;
            if (imgSrc) {
                currentImageData = imgSrc;
                uploadPreview.src = imgSrc;
                uploadPreview.classList.add('active');
                uploadPlaceholder.style.display = 'none';
            } else { resetImagePreview(); }
        } else {
            modalTitle.textContent = 'アプリ登録';
            form.reset(); resetImagePreview();
            if (isLearning && activeLearningGroup !== 'all') inputLearningGroup.value = activeLearningGroup;
        }
        renderModalTags(); renderTagSuggestions();
        modal.classList.add('active');
    }

    function closeModal() {
        modal.classList.remove('active');
        editingAppId = null; currentImageData = null; currentTags = [];
        form.reset(); resetImagePreview();
        tagListEl.innerHTML = ''; tagSuggestions.innerHTML = '';
    }

    function resetImagePreview() {
        uploadPreview.src = ''; uploadPreview.classList.remove('active'); uploadPlaceholder.style.display = '';
    }

    // ---------- Reorder ----------
    function reorderApps(fromId, toId) {
        const fi = apps.findIndex(a => a.id === fromId);
        const ti = apps.findIndex(a => a.id === toId);
        if (fi === -1 || ti === -1) return;
        const [moved] = apps.splice(fi, 1);
        apps.splice(ti, 0, moved);
        saveApps(); renderGrid(); showToast('並び替えました');
    }

    // ---------- Context Menu ----------
    function showContextMenu(x, y, id) {
        contextMenuTarget = id;
        contextMenu.style.left = `${x}px`; contextMenu.style.top = `${y}px`;
        contextMenu.classList.add('active');
    }
    function hideContextMenu() { contextMenu.classList.remove('active'); contextMenuTarget = null; }

    // ---------- Toast ----------
    function showToast(msg) {
        const t = document.createElement('div');
        t.className = 'toast'; t.textContent = msg;
        toastContainer.appendChild(t);
        setTimeout(() => t.remove(), 3200);
    }

    // ---------- CRUD ----------
    async function addApp(data) {
        const id = 'app_' + Date.now();
        const app = { id, name: data.name, url: data.url, caption: data.caption, tags: data.tags || [], _hasImage: !!data.image };
        if (data.learningGroup) app.learningGroup = data.learningGroup;
        apps.unshift(app);
        saveApps();
        if (data.image) await idbSave(id, data.image);
        renderTagFilterBar();
        await renderGrid();
        showToast(`「${data.name}」を登録しました`);
    }

    async function addSpacer() {
        apps.push({ id: 'spacer_' + Date.now(), type: 'spacer' });
        saveApps();
        await renderGrid();
        showToast('空白グリッドを追加しました');
    }

    async function updateApp(appId, data) {
        const idx = apps.findIndex(a => a.id === appId);
        if (idx === -1) return;
        apps[idx] = { ...apps[idx], name: data.name, url: data.url, caption: data.caption, tags: data.tags || [], _hasImage: !!data.image || apps[idx]._hasImage };
        if (isLearning) {
            if (data.learningGroup) apps[idx].learningGroup = data.learningGroup;
            else delete apps[idx].learningGroup;
        }
        saveApps();
        if (data.image) await idbSave(appId, data.image);
        renderTagFilterBar();
        await renderGrid();
        showToast(`「${data.name}」を更新しました`);
    }

    async function deleteApp(appId) {
        const app = apps.find(a => a.id === appId);
        if (!app) return;
        const label = app.type === 'spacer' ? '空白グリッド' : `「${app.name}」`;
        if (!confirm(`${label}を削除しますか？`)) return;
        apps = apps.filter(a => a.id !== appId);
        saveApps();
        await idbDelete(appId);
        if (isLearning) renderTagFilterBar();
        await renderGrid();
        showToast(`${label}を削除しました`);
    }

    // ---------- Particles ----------
    function createParticles() {
        const c = document.getElementById('particles');
        if (!c) return;
        for (let i = 0; i < 25; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = `${Math.random() * 100}%`;
            p.style.width = `${2 + Math.random() * 4}px`;
            p.style.height = p.style.width;
            p.style.animationDuration = `${8 + Math.random() * 12}s`;
            p.style.animationDelay = `${Math.random() * 10}s`;
            c.appendChild(p);
        }
    }

    // ---------- Event Listeners ----------
    function initEvents() {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { name: inputName.value.trim(), url: inputUrl.value.trim(), caption: inputCaption.value.trim(), image: currentImageData, tags: [...currentTags] };
            if (isLearning) data.learningGroup = inputLearningGroup.value;
            if (!data.name) return;
            if (editingAppId) await updateApp(editingAppId, data); else await addApp(data);
            closeModal();
        });

        btnAddTag.addEventListener('click', addTagFromInput);
        inputTag.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTagFromInput(); } });

        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value;
            searchClear.classList.toggle('visible', searchQuery.length > 0);
            renderGrid();
        });
        searchClear.addEventListener('click', () => { searchInput.value = ''; searchQuery = ''; searchClear.classList.remove('visible'); renderGrid(); });

        btnCancel.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        uploadArea.addEventListener('click', () => inputImage.click());
        inputImage.addEventListener('change', (e) => { if (e.target.files.length > 0) handleImageFile(e.target.files[0]); });

        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault(); uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) handleImageFile(e.dataTransfer.files[0]);
        });

        document.addEventListener('paste', (e) => {
            if (!modal.classList.contains('active')) return;
            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) { e.preventDefault(); handleImageFile(item.getAsFile()); break; }
            }
        });

        document.getElementById('ctxEdit').addEventListener('click', () => { if (contextMenuTarget) openModal(contextMenuTarget); hideContextMenu(); });
        document.getElementById('ctxOpen').addEventListener('click', () => {
            if (contextMenuTarget) { const a = apps.find(a => a.id === contextMenuTarget); if (a && a.url) window.open(a.url, '_blank'); }
            hideContextMenu();
        });
        document.getElementById('ctxDelete').addEventListener('click', () => { if (contextMenuTarget) deleteApp(contextMenuTarget); hideContextMenu(); });

        document.addEventListener('click', () => hideContextMenu());
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); hideContextMenu(); } });

        // Export button (local only)
        const exportBtn = document.getElementById('exportBtn');
        if (isLocal && exportBtn) {
            exportBtn.style.display = '';
            exportBtn.addEventListener('click', exportForDeploy);
        }
    }

    // ---------- Export for Vercel ----------
    async function exportForDeploy() {
        showToast('エクスポート準備中...');
        const exportData = [];
        for (const app of apps) {
            if (app.type === 'spacer') {
                exportData.push({ id: app.id, type: 'spacer' });
                continue;
            }
            const entry = {
                id: app.id,
                name: app.name,
                url: app.url || '',
                caption: app.caption || '',
                tags: app.tags || []
            };
            if (isLearning && app.learningGroup) entry.learningGroup = app.learningGroup;
            // Get image from IndexedDB
            if (app._hasImage) {
                const imgData = await idbLoad(app.id);
                if (imgData) entry.image = imgData;
            }
            exportData.push(entry);
        }

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${catId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`📤 ${catId}.json をダウンロードしました。data/ フォルダに保存してください`);
    }

    // ---------- Load from static JSON (Vercel) ----------
    async function loadFromStaticJSON() {
        try {
            const res = await fetch(`data/${catId}.json`, { cache: isLocal ? 'no-store' : 'default' });
            if (!res.ok) return false;
            const data = await res.json();
            apps = data.map(a => ({
                ...a,
                _hasImage: !!a.image
            }));
            // Store images to IDB for rendering
            for (const app of apps) {
                if (app.image) {
                    await idbSave(app.id, app.image);
                    delete app.image;
                }
            }
            return true;
        } catch {
            return false;
        }
    }

    // ---------- Init ----------
    async function init() {
        await openDB();
        setCategoryInfo();

        if (!isLocal) {
            // Vercel: load from static JSON first
            const loaded = await loadFromStaticJSON();
            if (!loaded) loadApps(); // fallback
        } else {
            // Local: load from localStorage + IndexedDB
            loadApps();
            await migrateToIDB();
            // If localStorage is empty, try loading from data/*.json as fallback
            if (apps.length === 0) {
                const loaded = await loadFromStaticJSON();
                if (loaded) {
                    saveApps(); // persist to localStorage for next time
                    showToast('📂 data/ フォルダからアプリデータを復元しました');
                }
            }
        }

        if (isLearning) initLearningTabs();
        renderTagFilterBar();
        await renderGrid();
        createParticles();
        initEvents();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
