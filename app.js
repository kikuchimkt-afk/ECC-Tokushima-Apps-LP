/* ============================================
   学習塾 Webアプリ ランディングページ - App JS
   ============================================ */

(() => {
  'use strict';

  // ---------- Default Roles ----------
  const DEFAULT_ROLES = [
    { name: 'master', label: 'マスター', password: '54834646', categories: '*' },
    { name: 'staff', label: '一般スタッフ', password: '11223344', categories: ['counter', 'learning', 'mini', 'database'] },
    { name: 'external', label: '外部', password: '55667788', categories: ['learning', 'database', 'mini'] },
    { name: 'student', label: '生徒', password: '99887766', categories: ['learning'] }
  ];
  const ROLES_STORAGE_KEY = 'lp_roles_config';
  const AUTH_KEY = 'lp_authenticated';
  const AUTH_ROLE_KEY = 'lp_auth_role';
  const AUTH_CATS_KEY = 'lp_auth_cats';

  // Load roles from localStorage or use defaults
  function loadRoles() {
    const stored = localStorage.getItem(ROLES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [...DEFAULT_ROLES];
  }
  function saveRoles(roles) {
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles));
  }
  let roles = loadRoles();

  // ---------- Local Check ----------
  const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:';

  // ---------- Default Categories ----------
  const DEFAULT_CATEGORIES = [
    { id: 'counter', title: 'カウンターツール', description: '生徒数カウント・出席管理など', icon: '🔢', image: 'images/counter.png', link: 'category.html?cat=counter' },
    { id: 'learning', title: '学習アプリ', description: '教科学習・テスト対策アプリ', icon: '📚', image: 'images/learning.png', link: 'category.html?cat=learning' },
    { id: 'accounting', title: '経理ツール', description: '月謝管理・会計処理ツール', icon: '💼', image: 'images/accounting.png', link: 'category.html?cat=accounting' },
    { id: 'mini', title: 'ミニアプリ', description: '便利な小型ユーティリティ', icon: '⚡', image: 'images/mini.png', link: 'category.html?cat=mini' },
    { id: 'database', title: 'データベース', description: 'データ管理・検索・分析ツール', icon: '🗄️', image: 'images/database.png', link: 'category.html?cat=database' }
  ];
  const STORAGE_KEY = 'lp_categories';

  // ---------- State ----------
  let categories = [];
  let editingCategoryId = null;
  let contextMenuTarget = null;
  let pendingLink = null;

  // ---------- DOM Elements ----------
  const grid = document.getElementById('categoryGrid');
  const modal = document.getElementById('categoryModal');
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('categoryForm');
  const inputTitle = document.getElementById('inputTitle');
  const inputDesc = document.getElementById('inputDescription');
  const inputIcon = document.getElementById('inputIcon');
  const inputImage = document.getElementById('inputImage');
  const inputLink = document.getElementById('inputLink');
  const btnCancel = document.getElementById('btnCancel');
  const contextMenu = document.getElementById('contextMenu');
  const toastContainer = document.getElementById('toastContainer');
  const lockBtn = document.getElementById('lockBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const passwordModal = document.getElementById('passwordModal');
  const passwordForm = document.getElementById('passwordForm');
  const inputPassword = document.getElementById('inputPassword');
  const pwError = document.getElementById('pwError');
  const settingsModal = document.getElementById('settingsModal');
  const settingsContent = document.getElementById('settingsContent');

  // ---------- Auth ----------
  function isAuthenticated() {
    return localStorage.getItem(AUTH_KEY) === 'true';
  }

  function getAuthRole() {
    return localStorage.getItem(AUTH_ROLE_KEY) || '';
  }

  function getAllowedCategories() {
    const stored = localStorage.getItem(AUTH_CATS_KEY);
    if (stored === '*') return '*';
    return stored ? JSON.parse(stored) : [];
  }

  function canAccessCategory(catId) {
    if (!isAuthenticated()) return false;
    const allowed = getAllowedCategories();
    return allowed === '*' || allowed.includes(catId);
  }

  function isMaster() {
    return isAuthenticated() && getAuthRole() === 'master';
  }

  function updateLockUI() {
    if (isAuthenticated()) {
      const role = getAuthRole();
      const roleObj = roles.find(r => r.name === role);
      lockBtn.textContent = '🔓';
      lockBtn.classList.add('unlocked');
      lockBtn.title = roleObj ? `${roleObj.label}でログイン中` : 'ログイン中';
    } else {
      lockBtn.textContent = '🔒';
      lockBtn.classList.remove('unlocked');
      lockBtn.title = 'ロック/アンロック';
    }
    // Show settings button only for master on local
    if (isLocal && isMaster()) {
      settingsBtn.style.display = '';
    } else {
      settingsBtn.style.display = 'none';
    }
  }

  function logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_ROLE_KEY);
    localStorage.removeItem(AUTH_CATS_KEY);
    updateLockUI();
    renderGrid();
    showToast('ログアウトしました');
  }

  // ---------- Storage ----------
  function loadCategories() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      categories = JSON.parse(stored);
      let updated = false;
      DEFAULT_CATEGORIES.forEach(def => {
        if (!categories.find(c => c.id === def.id)) {
          categories.push(def);
          updated = true;
        }
      });
      if (updated) saveCategories();
    } else {
      categories = [...DEFAULT_CATEGORIES];
      saveCategories();
    }
  }

  function saveCategories() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }

  // ---------- Render ----------
  async function renderGrid() {
    grid.innerHTML = '';

    for (let index = 0; index < categories.length; index++) {
      const cat = categories[index];
      const hasAccess = canAccessCategory(cat.id);

      // Hide inaccessible categories
      if (!hasAccess && isAuthenticated()) continue;

      const card = document.createElement('a');
      card.className = 'category-card';
      if (hasAccess) {
        card.href = cat.link || '#';
      } else {
        card.href = '#';
      }
      card.dataset.id = cat.id;
      card.style.animationDelay = `${index * 0.1}s`;
      card.style.animation = 'card-fade-in 0.6s ease-out forwards';
      card.style.opacity = '0';

      const appCount = await getAppCount(cat.id);

      card.innerHTML = `
        <div class="card-image">
          <img src="${cat.image}" alt="${cat.title}" loading="lazy" />
        </div>
        <div class="card-overlay"></div>
        <div class="card-content">
          <div class="card-icon">${cat.icon}</div>
          <div class="card-title">${cat.title}</div>
          <div class="card-description">${cat.description}</div>
          <div class="card-badge">
            <span class="dot"></span>
            ${appCount} アプリ登録済
          </div>
        </div>
        <div class="card-arrow">→</div>
      `;

      card.addEventListener('click', (e) => {
        if (!isAuthenticated()) {
          e.preventDefault();
          pendingLink = cat.link || '#';
          openPasswordModal();
        }
      });

      if (isLocal) {
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showContextMenu(e.clientX, e.clientY, cat.id);
        });
      }

      grid.appendChild(card);
    }

    // Show all cards but locked if not authenticated
    if (!isAuthenticated()) {
      // Cards were shown but not clickable
    }

    // Add "+" card (local only, master only)
    if (isLocal && isMaster()) {
      const addCard = document.createElement('div');
      addCard.className = 'add-category-card';
      addCard.id = 'addCategoryBtn';
      addCard.innerHTML = `<span class="plus-icon">+</span> カテゴリ追加`;
      addCard.addEventListener('click', () => openModal());
      grid.appendChild(addCard);
    }
  }

  async function getAppCount(catId) {
    const key = `lp_cat_${catId}_apps`;
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored).length;
    if (!isLocal) {
      try {
        const res = await fetch(`data/${catId}.json`);
        if (res.ok) return (await res.json()).length;
      } catch { /* ignore */ }
    }
    return 0;
  }

  // ---------- Card Fade-in Animation ----------
  const styleEl = document.createElement('style');
  styleEl.textContent = `@keyframes card-fade-in{from{opacity:0;transform:translateY(30px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}`;
  document.head.appendChild(styleEl);

  // ---------- Category Modal ----------
  function openModal(catId = null) {
    editingCategoryId = catId;
    if (catId) {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      modalTitle.textContent = 'カテゴリ編集';
      inputTitle.value = cat.title;
      inputDesc.value = cat.description;
      inputIcon.value = cat.icon;
      inputImage.value = cat.image;
      inputLink.value = cat.link;
    } else {
      modalTitle.textContent = '新規カテゴリ追加';
      form.reset();
      inputIcon.value = '📁';
    }
    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
    editingCategoryId = null;
    form.reset();
  }

  // ---------- CRUD ----------
  function addCategory(data) {
    const id = 'cat_' + Date.now();
    categories.push({
      id,
      title: data.title,
      description: data.description || '',
      icon: data.icon || '📁',
      image: data.image || 'images/bg.png',
      link: data.link || `category.html?cat=${id}`
    });
    saveCategories();
    renderGrid();
    showToast(`「${data.title}」を追加しました`);
  }

  function updateCategory(catId, data) {
    const idx = categories.findIndex(c => c.id === catId);
    if (idx === -1) return;
    categories[idx] = { ...categories[idx], ...data };
    saveCategories();
    renderGrid();
    showToast(`「${data.title}」を更新しました`);
  }

  function deleteCategory(catId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    if (!confirm(`「${cat.title}」を削除しますか？`)) return;
    categories = categories.filter(c => c.id !== catId);
    saveCategories();
    renderGrid();
    showToast(`「${cat.title}」を削除しました`);
  }

  // ---------- Context Menu ----------
  function showContextMenu(x, y, catId) {
    contextMenuTarget = catId;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.add('active');
  }

  function hideContextMenu() {
    contextMenu.classList.remove('active');
    contextMenuTarget = null;
  }

  // ---------- Toast ----------
  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // ---------- Particles ----------
  function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.width = `${2 + Math.random() * 4}px`;
      p.style.height = p.style.width;
      p.style.animationDuration = `${8 + Math.random() * 12}s`;
      p.style.animationDelay = `${Math.random() * 10}s`;
      container.appendChild(p);
    }
  }

  // =============================================
  //  Settings Modal (master + local only)
  // =============================================
  function openSettingsModal() {
    roles = loadRoles(); // Refresh
    settingsContent.innerHTML = '';

    const allCatIds = categories.map(c => c.id);

    roles.forEach((role, ri) => {
      const section = document.createElement('div');
      section.className = 'settings-role-section';

      const isMasterRole = role.name === 'master';
      const catsArray = role.categories === '*' ? [...allCatIds] : (role.categories || []);

      let catCheckboxes = '';
      if (!isMasterRole) {
        allCatIds.forEach(cid => {
          const cat = categories.find(c => c.id === cid);
          const checked = catsArray.includes(cid) ? 'checked' : '';
          catCheckboxes += `
            <label class="settings-cat-label">
              <input type="checkbox" data-role="${ri}" data-cat="${cid}" ${checked} />
              ${cat ? cat.icon + ' ' + cat.title : cid}
            </label>`;
        });
      }

      section.innerHTML = `
        <div class="settings-role-header">
          <span class="settings-role-label">${role.label}</span>
          <span class="settings-role-name">${role.name}</span>
        </div>
        <div class="settings-role-body">
          <div class="modal-field">
            <label>パスワード</label>
            <input type="text" class="settings-pw-input" data-role="${ri}" value="${role.password}" />
          </div>
          ${!isMasterRole ? `
          <div class="modal-field">
            <label>アクセス可能カテゴリ</label>
            <div class="settings-cat-grid">${catCheckboxes}</div>
          </div>` : '<div class="settings-master-note">全カテゴリにアクセス可能</div>'}
        </div>
      `;
      settingsContent.appendChild(section);
    });

    settingsModal.classList.add('active');
  }

  function closeSettingsModal() {
    settingsModal.classList.remove('active');
  }

  function saveSettings() {
    const pwInputs = settingsContent.querySelectorAll('.settings-pw-input');
    const catChecks = settingsContent.querySelectorAll('input[type="checkbox"][data-role]');

    // Update passwords
    pwInputs.forEach(inp => {
      const ri = parseInt(inp.dataset.role);
      const newPw = inp.value.trim();
      if (newPw) roles[ri].password = newPw;
    });

    // Update categories (non-master roles)
    roles.forEach((role, ri) => {
      if (role.name === 'master') return;
      const checked = [];
      catChecks.forEach(cb => {
        if (parseInt(cb.dataset.role) === ri && cb.checked) {
          checked.push(cb.dataset.cat);
        }
      });
      role.categories = checked;
    });

    saveRoles(roles);
    showToast('設定を保存しました');
  }

  function exportSettings() {
    const exportData = {
      roles: roles.map(r => ({
        name: r.name,
        label: r.label,
        password: r.password,
        categories: r.categories
      }))
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roles.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📤 roles.json をダウンロードしました。data/ フォルダに保存してください');
  }

  // ---------- Password Modal ----------
  function openPasswordModal() {
    pwError.style.display = 'none';
    inputPassword.value = '';
    passwordModal.classList.add('active');
    setTimeout(() => inputPassword.focus(), 100);
  }

  function closePasswordModal() {
    passwordModal.classList.remove('active');
    pendingLink = null;
  }

  // =============================================
  //  Load roles from static JSON (Vercel)
  // =============================================
  async function loadRolesFromJSON() {
    if (isLocal) return;
    try {
      const res = await fetch('data/roles.json');
      if (res.ok) {
        const data = await res.json();
        if (data.roles && Array.isArray(data.roles)) {
          roles = data.roles;
        }
      }
    } catch { /* ignore */ }
  }

  // ---------- Event Listeners ----------
  function initEvents() {
    // Category form
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {
        title: inputTitle.value.trim(),
        description: inputDesc.value.trim(),
        icon: inputIcon.value.trim() || '📁',
        image: inputImage.value.trim(),
        link: inputLink.value.trim()
      };
      if (!data.title) return;
      if (editingCategoryId) {
        updateCategory(editingCategoryId, data);
      } else {
        addCategory(data);
      }
      closeModal();
    });

    btnCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Context menu
    document.getElementById('ctxEdit').addEventListener('click', () => {
      if (contextMenuTarget) openModal(contextMenuTarget);
      hideContextMenu();
    });
    document.getElementById('ctxDelete').addEventListener('click', () => {
      if (contextMenuTarget) deleteCategory(contextMenuTarget);
      hideContextMenu();
    });
    document.addEventListener('click', () => hideContextMenu());

    // Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        hideContextMenu();
        closePasswordModal();
        closeSettingsModal();
      }
    });

    // Lock button
    lockBtn.addEventListener('click', () => {
      if (isAuthenticated()) {
        logout();
        // Show login modal again
        openPasswordModal();
      } else {
        pendingLink = null;
        openPasswordModal();
      }
    });

    // Password form
    passwordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = inputPassword.value.trim();
      const matched = roles.find(r => r.password === val);
      if (matched) {
        localStorage.setItem(AUTH_KEY, 'true');
        localStorage.setItem(AUTH_ROLE_KEY, matched.name);
        localStorage.setItem(AUTH_CATS_KEY, matched.categories === '*' ? '*' : JSON.stringify(matched.categories));
        updateLockUI();
        closePasswordModal();
        renderGrid();
        showToast(`${matched.label}としてログインしました`);
        if (pendingLink) {
          const catMatch = pendingLink.match(/cat=(\w+)/);
          if (catMatch && canAccessCategory(catMatch[1])) {
            window.location.href = pendingLink;
          } else if (catMatch) {
            showToast('🔒 このカテゴリへのアクセス権限がありません');
          }
          pendingLink = null;
        }
      } else {
        pwError.style.display = 'block';
        inputPassword.value = '';
        inputPassword.focus();
      }
    });

    passwordModal.addEventListener('click', (e) => {
      if (e.target === passwordModal && isAuthenticated()) closePasswordModal();
    });

    // Settings button
    settingsBtn.addEventListener('click', openSettingsModal);
    document.getElementById('btnSettingsClose').addEventListener('click', closeSettingsModal);
    document.getElementById('btnSettingsSave').addEventListener('click', () => {
      saveSettings();
      closeSettingsModal();
      // Re-login with updated settings if master
      if (isMaster()) {
        const masterRole = roles.find(r => r.name === 'master');
        if (masterRole) {
          localStorage.setItem(AUTH_CATS_KEY, '*');
        }
      }
    });
    document.getElementById('btnSettingsExport').addEventListener('click', exportSettings);

    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });
  }

  // ---------- Init ----------
  async function init() {
    await loadRolesFromJSON();
    loadCategories();
    await renderGrid();
    createParticles();
    initEvents();
    updateLockUI();

    // Auto-show login modal on first visit
    if (!isAuthenticated()) {
      openPasswordModal();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
