(function () {
  const data = window.QA_DATA_R08 || [];
  let currentFilter = 'all';
  let currentSearch = '';
  const saveTimers = {};

  // ==============================
  // Render
  // ==============================
  function render() {
    const list = document.getElementById('memoList');
    const memos = YakkaStore.getAllMemos();
    let html = '';
    let lastSection = '';

    data.forEach(item => {
      const hasMemo = !!memos[item.id] && memos[item.id].trim().length > 0;
      const memoText = memos[item.id] || '';

      if (currentFilter === 'has-memo' && !hasMemo) return;

      const search = currentSearch.toLowerCase();
      if (search) {
        const inTitle = item.title.toLowerCase().includes(search);
        const inBreadcrumb = item.breadcrumb.toLowerCase().includes(search);
        const inMemo = memoText.toLowerCase().includes(search);
        if (!inTitle && !inBreadcrumb && !inMemo) return;
      }

      if (item.section !== lastSection) {
        lastSection = item.section;
        html += `<div class="mp-section-header">${item.section}</div>`;
      }

      html += `
        <div class="mp-item" data-id="${item.id}">
          <div class="mp-item-header" onclick="toggleItem(${item.id})">
            <div class="mp-item-title">
              <span class="mp-item-num">${item.id}</span>
              <span class="mp-item-text">${escHtml(item.title)}</span>
            </div>
            <div class="mp-item-right">
              ${hasMemo ? '<span class="mp-has-memo">✏️</span>' : ''}
              <span class="mp-chevron" id="chev-${item.id}">&#9660;</span>
            </div>
          </div>
          <div class="mp-item-body" id="body-${item.id}" style="display:none">
            <div class="mp-breadcrumb">${escHtml(item.breadcrumb)}</div>
            <textarea
              class="mp-textarea"
              id="ta-${item.id}"
              placeholder="この項目のメモを入力..."
              oninput="onMemoInput(${item.id})"
            >${escHtml(memoText)}</textarea>
            <div class="mp-save-status" id="st-${item.id}"></div>
          </div>
        </div>`;
    });

    if (!html) {
      html = '<div class="mp-empty">該当する項目がありません</div>';
    }

    list.innerHTML = html;
  }

  // ==============================
  // Toggle item open/close
  // ==============================
  window.toggleItem = function (id) {
    const body = document.getElementById('body-' + id);
    const chev = document.getElementById('chev-' + id);
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    chev.innerHTML = isOpen ? '&#9660;' : '&#9650;';
    if (!isOpen) {
      document.getElementById('ta-' + id).focus();
    }
  };

  // ==============================
  // Memo save (debounced)
  // ==============================
  window.onMemoInput = function (id) {
    const st = document.getElementById('st-' + id);
    st.textContent = '...';
    clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(() => {
      const text = document.getElementById('ta-' + id).value;
      YakkaStore.saveMemo(id, text);
      st.textContent = '保存済み ✓';
      setTimeout(() => { st.textContent = ''; }, 1500);
      // update ✏️ badge without full re-render
      const badge = document.querySelector(`.mp-item[data-id="${id}"] .mp-has-memo`);
      const right = document.querySelector(`.mp-item[data-id="${id}"] .mp-item-right`);
      if (text.trim()) {
        if (!badge) {
          const chev = document.getElementById('chev-' + id);
          right.insertAdjacentHTML('afterbegin', '<span class="mp-has-memo">✏️</span>');
        }
      } else {
        if (badge) badge.remove();
      }
    }, 600);
  };

  // ==============================
  // Search
  // ==============================
  const searchInput = document.getElementById('memoSearchInput');
  const searchClear = document.getElementById('memoSearchClear');
  let searchTimer;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchClear.classList.toggle('visible', searchInput.value.length > 0);
    searchTimer = setTimeout(() => {
      currentSearch = searchInput.value.trim();
      render();
    }, 200);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    searchClear.classList.remove('visible');
    render();
    searchInput.focus();
  });

  // ==============================
  // Filter tabs
  // ==============================
  document.querySelectorAll('.memo-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.memo-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // ==============================
  // Export / Import
  // ==============================
  document.getElementById('memoExportBtn').addEventListener('click', () => {
    const json = YakkaStore.exportMemos();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yakka_memos.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('memoImportInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        YakkaStore.importMemos(ev.target.result);
        alert('メモをインポートしました');
        render();
      } catch (err) {
        alert('インポートに失敗しました: ' + err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // ==============================
  // Helpers
  // ==============================
  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ==============================
  // Init
  // ==============================
  render();
})();
