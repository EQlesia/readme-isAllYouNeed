// script.js - 業務ナビゲーター
'use strict';

// ========== STATE ==========
const STATE = {
  data: [],
  filteredData: [],
  selectedId: null,
  searchQuery: '',
  editingId: null,
};

const RECENT_KEY  = 'navRecentIds';
const DATA_KEY    = 'navDataStore';
const RECENT_MAX  = 3;

const CATEGORY_ORDER = ['毎日', '週次', '月次', '随時', '期間限定'];

const $ = id => document.getElementById(id);

// ========== INIT ==========
async function init() {
  loadData();
  renderSidebar();
  renderQuickAccess();
  setupSearch();
  setupEditModal();
  setupExportModal();
  updateStatusBar();
}

// ========== DATA LOADING ==========
// 優先順位:
//   1. LocalStorage に保存済みデータがあればそちらを使用（file:// 制約を回避しつつ編集を永続化）
//   2. なければ data.js の window.GYOMU_DATA を初期データとして使用
function loadData() {
  const stored = localStorage.getItem(DATA_KEY);
  if (stored) {
    try {
      STATE.data = JSON.parse(stored);
    } catch {
      STATE.data = [];
    }
  } else if (Array.isArray(window.GYOMU_DATA)) {
    STATE.data = JSON.parse(JSON.stringify(window.GYOMU_DATA)); // deep copy
    persistData(); // 初回はLocalStorageに書き込んでおく
  } else {
    STATE.data = [];
    showToast('data.js の読み込みに失敗しました。', 'error');
  }
  STATE.filteredData = [...STATE.data];
}

// LocalStorage に保存
function persistData() {
  localStorage.setItem(DATA_KEY, JSON.stringify(STATE.data));
}

// ========== RECENT ==========
function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function pushRecent(id) {
  let list = getRecent().filter(x => x !== id);
  list.unshift(id);
  list = list.slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

function renderQuickAccess() {
  const container = $('quick-access-items');
  const emptyEl   = $('quick-access-empty');
  container.innerHTML = '';
  const valid = getRecent().filter(id => STATE.data.find(d => d.id === id));

  if (valid.length === 0) { emptyEl.style.display = ''; return; }
  emptyEl.style.display = 'none';

  valid.forEach(id => {
    const item = STATE.data.find(d => d.id === id);
    if (!item) return;
    const el = document.createElement('div');
    el.className = 'quick-item' + (STATE.selectedId === id ? ' active' : '');
    el.innerHTML = `<span class="quick-item-dot"></span><span class="quick-item-name">${escHtml(item.name)}</span>`;
    el.addEventListener('click', () => selectItem(id));
    container.appendChild(el);
  });
}

// ========== SIDEBAR ==========
function renderSidebar() {
  const sidebar = $('sidebar-categories');
  sidebar.innerHTML = '';

  const groups = {};
  CATEGORY_ORDER.forEach(cat => { groups[cat] = []; });
  STATE.filteredData.forEach(item => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });

  CATEGORY_ORDER.forEach(cat => {
    const items = groups[cat];
    if (items.length === 0) return;

    const group  = document.createElement('div');
    group.className = 'category-group';

    const isOpen = STATE.searchQuery !== '' || cat === '毎日';
    const header = document.createElement('div');
    header.className = 'category-header' + (isOpen ? ' open' : '');
    header.innerHTML = `
      <span class="category-arrow">${isOpen ? '▼' : '▶'}</span>
      <span>${escHtml(cat)}</span>
      <span class="category-count">${items.length}</span>
    `;
    header.addEventListener('click', () => toggleCategory(header));

    const itemsEl = document.createElement('div');
    itemsEl.className = 'category-items' + (isOpen ? ' open' : '');

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'sidebar-item' + (STATE.selectedId === item.id ? ' active' : '');
      el.dataset.id = item.id;
      el.textContent = item.name;
      el.title = item.name;
      el.addEventListener('click', () => selectItem(item.id));
      itemsEl.appendChild(el);
    });

    group.appendChild(header);
    group.appendChild(itemsEl);
    sidebar.appendChild(group);
  });
}

function toggleCategory(header) {
  const open  = header.classList.contains('open');
  const items = header.nextElementSibling;
  const arrow = header.querySelector('.category-arrow');
  if (open) {
    header.classList.remove('open'); items.classList.remove('open'); arrow.textContent = '▶';
  } else {
    header.classList.add('open');    items.classList.add('open');    arrow.textContent = '▼';
  }
}

// ========== SEARCH ==========
function setupSearch() {
  const input    = $('search-input');
  const clearBtn = $('search-clear');

  input.addEventListener('input', () => {
    STATE.searchQuery = input.value.trim();
    clearBtn.classList.toggle('visible', STATE.searchQuery !== '');
    performSearch();
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    STATE.searchQuery = '';
    clearBtn.classList.remove('visible');
    performSearch();
    input.focus();
  });
}

function performSearch() {
  const q = STATE.searchQuery.toLowerCase();

  if (q === '') {
    STATE.filteredData = [...STATE.data];
    $('search-results').style.display = 'none';
    $('no-results').style.display = 'none';
    renderSidebar();
    if (STATE.selectedId) { showDetail(STATE.selectedId); }
    else { $('empty-state').style.display = ''; $('detail-card').style.display = 'none'; }
    return;
  }

  STATE.filteredData = STATE.data.filter(item =>
    item.name.toLowerCase().includes(q)
    || (item.description || '').toLowerCase().includes(q)
    || (item.category || '').toLowerCase().includes(q)
    || (item.steps || '').toLowerCase().includes(q)
    || (item.links || []).some(l => l.label.toLowerCase().includes(q) || l.path.toLowerCase().includes(q))
  );

  renderSidebar();
  renderSearchResults(q);
  $('empty-state').style.display = 'none';
  $('detail-card').style.display = 'none';
  updateStatusBar();
}

function renderSearchResults(q) {
  const container = $('search-results');
  if (STATE.filteredData.length === 0) {
    container.style.display = 'none';
    $('no-results').style.display = '';
    return;
  }
  $('no-results').style.display = 'none';
  container.style.display = 'block';
  $('search-results-header').textContent = `"${STATE.searchQuery}" の検索結果: ${STATE.filteredData.length} 件`;

  const list = $('search-results-list');
  list.innerHTML = '';
  STATE.filteredData.forEach(item => {
    const el   = document.createElement('div');
    el.className = 'search-result-item';
    const desc = (item.description || '').substring(0, 80) + ((item.description || '').length > 80 ? '...' : '');
    el.innerHTML = `
      <div class="search-result-name">${highlight(escHtml(item.name), q)}</div>
      <div class="search-result-meta">${escHtml(item.category)}</div>
      <div class="search-result-desc">${highlight(escHtml(desc), q)}</div>
    `;
    el.addEventListener('click', () => { selectItem(item.id); container.style.display = 'none'; });
    list.appendChild(el);
  });
}

function highlight(text, q) {
  if (!q) return text;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
}

// ========== SELECT / DETAIL ==========
function selectItem(id) {
  STATE.selectedId = id;
  pushRecent(id);
  renderSidebar();
  renderQuickAccess();
  showDetail(id);
  updateStatusBar();
}

function showDetail(id) {
  const item = STATE.data.find(d => d.id === id);
  if (!item) return;

  $('empty-state').style.display     = 'none';
  $('search-results').style.display  = 'none';
  $('no-results').style.display      = 'none';
  $('detail-card').style.display     = 'block';

  const badge = $('detail-category-badge');
  badge.textContent = item.category;
  badge.className   = `detail-category-badge badge-${item.category}`;

  $('detail-name').textContent        = item.name;
  $('detail-id').textContent          = 'ID: ' + item.id;
  $('detail-description').textContent = item.description || '';

  // Steps
  const stepsList = $('detail-steps');
  stepsList.innerHTML = '';
  if (item.steps) {
    item.steps.split('\n').filter(l => l.trim()).forEach((line, i) => {
      const text = line.replace(/^\d+\.\s*/, '');
      const li   = document.createElement('li');
      li.className   = 'step-item';
      li.innerHTML   = `<span class="step-num">${i + 1}</span><span>${escHtml(text)}</span>`;
      stepsList.appendChild(li);
    });
  }

  // Links
  const linksContainer = $('detail-links');
  linksContainer.innerHTML = '';
  if (item.links && item.links.length > 0) {
    item.links.forEach(link => {
      const isUrl = /^https?:\/\//.test(link.path);
      const row   = document.createElement('div');
      row.className = 'link-item';
      row.innerHTML = `
        <span class="link-label">${escHtml(link.label)}</span>
        <span class="link-path${isUrl ? ' is-url' : ''}" title="${escHtml(link.path)}">${escHtml(link.path)}</span>
        <button class="link-copy-btn">Copy Path</button>
      `;
      row.querySelector('.link-copy-btn').addEventListener('click', function() {
        copyPath(link.path, this);
      });
      linksContainer.appendChild(row);
    });
  } else {
    linksContainer.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">関連リンクなし</span>';
  }

  $('detail-edit-btn').onclick   = () => openEditModal(id);
  $('detail-delete-btn').onclick = () => deleteItem(id);
}

async function copyPath(path, btn) {
  const restore = () => { btn.textContent = 'Copy Path'; btn.classList.remove('copied'); };
  try {
    await navigator.clipboard.writeText(path);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = path; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  }
  btn.textContent = 'Copied!'; btn.classList.add('copied');
  setTimeout(restore, 1800);
}

// ========== EDIT MODAL ==========
function setupEditModal() {
  $('add-btn').addEventListener('click',          () => openEditModal(null));
  $('modal-close').addEventListener('click',      closeModal);
  $('modal-cancel-btn').addEventListener('click', closeModal);
  $('modal-save-btn').addEventListener('click',   saveModal);
  $('add-link-btn').addEventListener('click',     addLinkRow);
  $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });
}

function openEditModal(id) {
  STATE.editingId = id;
  const item = id ? STATE.data.find(d => d.id === id) : null;
  $('modal-title').textContent  = id ? '業務を編集' : '新規業務を追加';
  $('form-name').value          = item ? item.name : '';
  $('form-category').value      = item ? item.category : '随時';
  $('form-description').value   = item ? (item.description || '') : '';
  $('form-steps').value         = item ? (item.steps || '') : '';

  const linksEditor = $('links-editor');
  linksEditor.innerHTML = '';
  const links = item && item.links ? item.links : [];
  if (links.length === 0) addLinkRow(); else links.forEach(l => addLinkRow(l.label, l.path));

  $('modal-overlay').classList.add('open');
  setTimeout(() => $('form-name').focus(), 50);
}

function addLinkRow(label = '', path = '') {
  const row = document.createElement('div');
  row.className = 'link-editor-row';
  row.innerHTML = `
    <input type="text" placeholder="ラベル" value="${escAttr(label)}" class="link-label-input">
    <input type="text" placeholder="パス または URL" value="${escAttr(path)}" class="link-path-input" style="flex:2">
    <button type="button" title="削除">-</button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  $('links-editor').appendChild(row);
}

function closeModal() {
  $('modal-overlay').classList.remove('open');
  STATE.editingId = null;
}

function saveModal() {
  const name = $('form-name').value.trim();
  if (!name) { $('form-name').focus(); return; }

  const category    = $('form-category').value;
  const description = $('form-description').value.trim();
  const steps       = $('form-steps').value.trim();
  const links       = [];
  document.querySelectorAll('.link-editor-row').forEach(row => {
    const label = row.querySelector('.link-label-input').value.trim();
    const path  = row.querySelector('.link-path-input').value.trim();
    if (label || path) links.push({ label, path });
  });

  if (STATE.editingId) {
    const idx = STATE.data.findIndex(d => d.id === STATE.editingId);
    if (idx >= 0) STATE.data[idx] = { ...STATE.data[idx], name, category, description, steps, links };
  } else {
    const newId = 'u-' + String(Date.now()).slice(-6);
    STATE.data.push({ id: newId, name, category, description, steps, links });
    STATE.selectedId = newId;
  }

  persistData(); // LocalStorage に即時保存
  closeModal();
  STATE.filteredData = [...STATE.data];
  renderSidebar();
  renderQuickAccess();
  if (STATE.selectedId) showDetail(STATE.selectedId);
  updateStatusBar();
  showToast('保存しました。', 'info');
}

function deleteItem(id) {
  const item = STATE.data.find(d => d.id === id);
  if (!item) return;
  if (!confirm(`「${item.name}」を削除しますか？\nこの操作は元に戻せません。`)) return;

  STATE.data         = STATE.data.filter(d => d.id !== id);
  STATE.filteredData = STATE.filteredData.filter(d => d.id !== id);
  if (STATE.selectedId === id) STATE.selectedId = null;
  localStorage.setItem(RECENT_KEY, JSON.stringify(getRecent().filter(x => x !== id)));

  persistData();
  renderSidebar();
  renderQuickAccess();
  $('detail-card').style.display = 'none';
  $('empty-state').style.display = '';
  updateStatusBar();
  showToast('削除しました。', 'info');
}

// ========== EXPORT MODAL ==========
// data.js の内容を画面上に表示し、手動でコピーして上書き保存してもらう。
// file:// 制約のため自動書き込みは不可だが、これで再配置作業を最小化できる。
function setupExportModal() {
  $('export-btn').addEventListener('click', openExportModal);
  $('export-modal-close').addEventListener('click',  closeExportModal);
  $('export-modal-overlay').addEventListener('click', e => {
    if (e.target === $('export-modal-overlay')) closeExportModal();
  });
  $('export-copy-btn').addEventListener('click', () => {
    const ta = $('export-textarea');
    ta.select();
    try {
      navigator.clipboard.writeText(ta.value).catch(() => document.execCommand('copy'));
    } catch {
      document.execCommand('copy');
    }
    $('export-copy-btn').textContent = 'コピー完了 !';
    setTimeout(() => { $('export-copy-btn').textContent = '全文コピー'; }, 2000);
  });
  $('export-download-btn').addEventListener('click', () => {
    const content = $('export-textarea').value;
    const blob = new Blob([content], { type: 'text/javascript' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'data.js';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('data.js をダウンロードしました。admin/data/ へ上書きしてください。', 'info');
  });
  $('export-reset-btn').addEventListener('click', () => {
    if (!confirm('データを data.js の初期状態にリセットしますか？\nLocalStorage の変更内容は全て消えます。')) return;
    localStorage.removeItem(DATA_KEY);
    localStorage.removeItem(RECENT_KEY);
    location.reload();
  });
}

function openExportModal() {
  const json    = JSON.stringify(STATE.data, null, 2);
  const content = 'window.GYOMU_DATA = ' + json + ';\n';
  $('export-textarea').value = content;
  $('export-modal-overlay').classList.add('open');
  $('export-total-count').textContent = STATE.data.length;
}

function closeExportModal() {
  $('export-modal-overlay').classList.remove('open');
}

// ========== STATUS BAR ==========
function updateStatusBar() {
  const total    = STATE.data.length;
  const filtered = STATE.filteredData.length;
  $('status-count').textContent = STATE.searchQuery
    ? `${filtered} / ${total} 件の業務が一致`
    : `全 ${total} 件の業務`;
}

// ========== TOAST ==========
function showToast(msg, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `position:fixed;bottom:32px;left:50%;transform:translateX(-50%);
      color:#fff;padding:8px 16px;border-radius:4px;font-size:13px;
      z-index:9999;max-width:480px;text-align:center;transition:opacity 0.2s;`;
    document.body.appendChild(toast);
  }
  toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--text-primary)';
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3200);
}

// ========== HELPERS ==========
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}

// ========== START ==========
document.addEventListener('DOMContentLoaded', init);
