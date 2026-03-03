/* ============================================
   学習塾 Webアプリ ランディングページ - App JS
   ============================================ */

(() => {
  'use strict';

  // ---------- Password Config ----------
  const PASSWORD = '54834646';
  const AUTH_KEY = 'lp_authenticated';

  // ---------- Local Check ----------
  const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:';

  // ---------- Default Categories ----------
  const DEFAULT_CATEGORIES = [
    {
      id: 'counter',
      title: 'カウンターツール',
      description: '生徒数カウント・出席管理など',
      icon: '🔢',
      image: 'images/counter.png',
      link: 'category.html?cat=counter'
    },
    {
      id: 'learning',
      title: '学習アプリ',
      description: '教科学習・テスト対策アプリ',
      icon: '📚',
      image: 'images/learning.png',
      link: 'category.html?cat=learning'
    },
    {
      id: 'accounting',
      title: '経理ツール',
      description: '月謝管理・会計処理ツール',
      icon: '💼',
      image: 'images/accounting.png',
      link: 'category.html?cat=accounting'
    },
    {
      id: 'mini',
      title: 'ミニアプリ',
      description: '便利な小型ユーティリティ',
      icon: '⚡',
      image: 'images/mini.png',
      link: 'category.html?cat=mini'
    },
    {
      id: 'database',
      title: 'データベース',
      description: 'データ管理・検索・分析ツール',
      icon: '🗄️',
      image: 'images/database.png',
      link: 'category.html?cat=database'
    }
  ];

  const STORAGE_KEY = 'lp_categories';

  // ---------- State ----------
  let categories = [];
  let editingCategoryId = null;
  let contextMenuTarget = null;

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
  const passwordModal = document.getElementById('passwordModal');
  const passwordForm = document.getElementById('passwordForm');
  const inputPassword = document.getElementById('inputPassword');
  const pwError = document.getElementById('pwError');
  const btnPwCancel = document.getElementById('btnPwCancel');
  let pendingLink = null; // link to navigate after auth

  // ---------- Auth ----------
  function isAuthenticated() {
    return localStorage.getItem(AUTH_KEY) === 'true';
  }

  function updateLockUI() {
    if (isAuthenticated()) {
      lockBtn.textContent = '🔓';
      lockBtn.classList.add('unlocked');
    } else {
      lockBtn.textContent = '🔒';
      lockBtn.classList.remove('unlocked');
    }
  }

  // ---------- Storage ----------
  function loadCategories() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      categories = JSON.parse(stored);
      // Merge any new default categories that don't exist yet
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
  function renderGrid() {
    grid.innerHTML = '';

    categories.forEach((cat, index) => {
      const card = document.createElement('a');
      card.className = 'category-card';
      if (isAuthenticated()) {
        card.href = cat.link || '#';
      } else {
        card.href = '#';
      }
      card.dataset.id = cat.id;
      card.style.animationDelay = `${index * 0.1}s`;
      card.style.animation = 'card-fade-in 0.6s ease-out forwards';
      card.style.opacity = '0';

      // Count apps in this category
      const appCount = getAppCount(cat.id);

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

      // Click handler with auth check
      card.addEventListener('click', (e) => {
        if (!isAuthenticated()) {
          e.preventDefault();
          pendingLink = cat.link || '#';
          openPasswordModal();
        }
      });

      // Right-click context menu (local only)
      if (isLocal) {
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showContextMenu(e.clientX, e.clientY, cat.id);
        });
      }

      grid.appendChild(card);
    });

    // Add "+" card (local only)
    if (isLocal) {
      const addCard = document.createElement('div');
      addCard.className = 'add-category-card';
      addCard.id = 'addCategoryBtn';
      addCard.innerHTML = `<span class="plus-icon">+</span> カテゴリ追加`;
      addCard.addEventListener('click', () => openModal());
      grid.appendChild(addCard);
    }
  }

  function getAppCount(catId) {
    const key = `lp_cat_${catId}_apps`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored).length;
    }
    return 0;
  }

  // ---------- Card Fade-in Animation ----------
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes card-fade-in {
      from { opacity: 0; transform: translateY(30px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(styleEl);

  // ---------- Modal ----------
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
      inputLink.value = 'category.html?cat=';
    }
    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
    editingCategoryId = null;
    form.reset();
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
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  // ---------- CRUD ----------
  function addCategory(data) {
    const id = data.title.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    categories.push({
      id,
      title: data.title,
      description: data.description,
      icon: data.icon || '📁',
      image: data.image || 'images/default.png',
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

  // ---------- Particles ----------
  function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
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

  // ---------- Event Listeners ----------
  function initEvents() {
    // Form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {
        title: inputTitle.value.trim(),
        description: inputDesc.value.trim(),
        icon: inputIcon.value.trim(),
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

    // Cancel
    btnCancel.addEventListener('click', closeModal);

    // Backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Context menu: edit
    document.getElementById('ctxEdit').addEventListener('click', () => {
      if (contextMenuTarget) openModal(contextMenuTarget);
      hideContextMenu();
    });

    // Context menu: delete
    document.getElementById('ctxDelete').addEventListener('click', () => {
      if (contextMenuTarget) deleteCategory(contextMenuTarget);
      hideContextMenu();
    });

    // Hide context menu on click elsewhere
    document.addEventListener('click', () => hideContextMenu());

    // Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        hideContextMenu();
        closePasswordModal();
      }
    });

    // Lock button
    lockBtn.addEventListener('click', () => {
      if (isAuthenticated()) {
        localStorage.removeItem(AUTH_KEY);
        updateLockUI();
        renderGrid();
        showToast('ロックしました');
      } else {
        pendingLink = null;
        openPasswordModal();
      }
    });

    // Password form
    passwordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = inputPassword.value.trim();
      if (val === PASSWORD) {
        localStorage.setItem(AUTH_KEY, 'true');
        updateLockUI();
        closePasswordModal();
        renderGrid();
        showToast('アンロックしました');
        if (pendingLink) {
          window.location.href = pendingLink;
          pendingLink = null;
        }
      } else {
        pwError.style.display = 'block';
        inputPassword.value = '';
        inputPassword.focus();
      }
    });

    btnPwCancel.addEventListener('click', closePasswordModal);

    passwordModal.addEventListener('click', (e) => {
      if (e.target === passwordModal) closePasswordModal();
    });
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

  // ---------- Init ----------
  function init() {
    loadCategories();
    renderGrid();
    createParticles();
    initEvents();
    updateLockUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
