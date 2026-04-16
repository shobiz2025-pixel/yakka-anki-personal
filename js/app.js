(function() {
  const viewed = YakkaStore.getViewedSet();
  let currentFilter = 'all';
  let currentSearch = '';
  let currentIndex = -1;
  let filteredItems = [];

  // Format answer text: escape HTML, convert \n to <br>, render **bold**
  function formatAnswer(text) {
    let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  // Trim long titles: cut from "（" that is not a numbering prefix or short reference
  function trimTitle(title) {
    const leadMatch = title.match(/^(?:（[０-９0-9]+）|[０-９0-9]+\s)/);
    const start = leadMatch ? leadMatch[0].length : 0;
    const rest = title.substring(start);
    const m = rest.match(/（(?![０-９0-9ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+）)/);
    if (m) return title.substring(0, start + m.index).replace(/\s+$/, '');
    return title;
  }

  function getChapterClass(section) {
    if (section.includes('第１章')) return 'ch1';
    if (section.includes('第２章')) return 'ch2';
    if (section.includes('第５節 再算定')) return 'ch3';
    if (section.includes('第３章')) return 'ch3';
    if (section.includes('第４章')) return 'ch4';
    return '';
  }

  function getCurrentQaData() {
    return typeof QA_DATA_R08 !== 'undefined' ? QA_DATA_R08 : [];
  }
  function getCurrentQaTextAll() {
    return typeof QA_TEXT_ALL_R08 !== 'undefined' ? QA_TEXT_ALL_R08 : {};
  }

  function getFilteredData() {
    return getCurrentQaData().filter(item => {
      const matchFilter = currentFilter === 'all' || item.section.includes(currentFilter);
      const matchSearch = !currentSearch ||
        item.title.includes(currentSearch) ||
        item.answer.includes(currentSearch) ||
        item.breadcrumb.includes(currentSearch) ||
        getQaTextsForItem(item).includes(currentSearch);
      return matchFilter && matchSearch;
    });
  }

  function getAssessClass(mark) {
    if (mark === '○') return 'mark-good';
    if (mark === '△') return 'mark-shaky';
    if (mark === '×') return 'mark-bad';
    return '';
  }

  function renderList() {
    filteredItems = getFilteredData();
    const list = document.getElementById('questionList');
    const allStats = YakkaStore.getAllItemStats();

    let html = '';
    let lastSection = '';

    filteredItems.forEach((item, idx) => {
      const sectionKey = item.breadcrumb || item.section;
      if (sectionKey !== lastSection) {
        lastSection = sectionKey;
        const chClass = getChapterClass(item.section);
        html += `<div class="section-header ${chClass}">${sectionKey}</div>`;
      }

      const stat = allStats[item.id] || { viewCount: 0, assessment: null };
      const viewedClass = stat.viewCount > 0 ? ' viewed' : '';
      const slideBadge = item.slides && item.slides.length > 0
        ? `<span class="q-badge">${item.slides.length}枚</span>` : '';
      const memoBadge = YakkaStore.hasMemo(item.id)
        ? '<span class="q-memo-badge">✏️</span>' : '';

      let metaHtml = '';
      if (stat.viewCount > 0 || stat.assessment) {
        metaHtml = '<div class="q-meta">';
        if (stat.viewCount > 0) metaHtml += `<span class="q-view-count">${stat.viewCount}回</span>`;
        if (stat.assessment) metaHtml += `<span class="q-assess-mark ${getAssessClass(stat.assessment)}">${stat.assessment}</span>`;
        metaHtml += '</div>';
      }

      html += `
        <div class="q-item${viewedClass}" data-idx="${idx}">
          <div class="q-num">${item.id}</div>
          <div class="q-text">
            <div class="q-title">${trimTitle(item.title)}</div>
            ${metaHtml}
          </div>
          ${memoBadge}${slideBadge}
          <div class="q-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>`;
    });

    list.innerHTML = html;

    list.querySelectorAll('.q-item').forEach(el => {
      el.addEventListener('click', () => {
        openAnswer(parseInt(el.dataset.idx));
      });
    });

    updateProgress();
  }

  // ==============================
  // Q&A ALL view
  // ==============================
  function renderQaAllView() {
    const view = document.getElementById('qaAllView');
    if (!view) return;
    const data = getCurrentQaData();
    const qaTextAll = getCurrentQaTextAll();
    let html = '';
    let lastSection = '';
    const shownQaKeys = new Set(); // 重複排除用
    const sectionList = []; // TOC用
    let sectionIdx = 0;

    data.forEach(item => {
      // 未表示のQ&Aキーのみ取得（重複排除）
      const qaSlides = (item.slides || []).filter(s => s.startsWith('qa_') && !shownQaKeys.has(s));
      if (qaSlides.length === 0) return; // Q&Aなし条文はスキップ

      const texts = qaSlides.map(s => {
        shownQaKeys.add(s);
        return qaTextAll[s];
      }).filter(Boolean);
      if (texts.length === 0) return;

      const rawText = texts.join('\n\n');
      const filtered = item.qa_questions && item.qa_questions.length > 0
        ? filterQaTextByQuestions(rawText, item.qa_questions)
        : rawText;
      if (!filtered) return;

      const sectionKey = item.breadcrumb || item.section;
      if (sectionKey !== lastSection) {
        lastSection = sectionKey;
        const chClass = getChapterClass(item.section);
        const anchorId = 'qa-sec-' + sectionIdx++;
        sectionList.push({ id: anchorId, label: sectionKey, chClass });
        html += `<div id="${anchorId}" class="qa-all-section-header ${chClass}">${sectionKey}</div>`;
      }

      const memo = YakkaStore.getMemo(item.id);
      const memoHtml = memo ? `<div class="qa-all-memo"><span class="qa-all-memo-label">自分メモ</span><div class="qa-all-memo-body">${escapeHtml(memo)}</div></div>` : '';
      html += `<div class="qa-all-item">
        <div class="qa-all-subsection-header">${item.title}</div>
        <div class="qa-text-content">${formatQaText(filtered)}</div>
        ${memoHtml}
      </div>`;
    });

    // TOCナビゲーション
    let tocHtml = '<div class="qa-all-toc"><div class="qa-all-toc-toggle" onclick="this.parentElement.classList.toggle(\'open\')">▼ セクションジャンプ <span class="qa-all-toc-count">(' + sectionList.length + ')</span></div><div class="qa-all-toc-links">';
    sectionList.forEach(sec => {
      tocHtml += `<a class="qa-all-toc-link ${sec.chClass}" onclick="document.getElementById('${sec.id}').scrollIntoView({behavior:'smooth',block:'start'});">${escapeHtml(sec.label)}</a>`;
    });
    tocHtml += '</div></div>';

    view.innerHTML = tocHtml + html;
  }

  // ==============================
  // Q&A Text formatting
  // ==============================
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatQaText(rawText) {
    const lines = rawText.split('\n');
    let html = '';
    let i = 0;
    // state: 'none' | 'question' | 'answer' | 'commentary' | 'notes' | 'reference'
    let state = 'none';

    while (i < lines.length) {
      const line = lines[i].trim();

      // Detect table block (consecutive lines starting with |)
      if (line.startsWith('|')) {
        html += buildTable(lines, i);
        while (i < lines.length && lines[i].trim().startsWith('|')) i++;
        continue;
      }

      if (!line) { i++; continue; }

      // State transitions and classification
      if (/^問\s*\d/.test(line) || /^問\d/.test(line)) {
        state = 'question';
        html += `<div class="qa-q-line">${escapeHtml(line)}</div>`;
      } else if (/^（答）/.test(line)) {
        state = 'answer';
        html += `<div class="qa-a-line">${escapeHtml(line)}</div>`;
      } else if (/^（解説）/.test(line)) {
        state = 'commentary';
        html += `<div class="qa-ex-line">${escapeHtml(line)}</div>`;
      } else if (/^（注）/.test(line)) {
        state = 'notes';
        html += `<div class="qa-ex-line">${escapeHtml(line)}</div>`;
      } else if (/^（参考）/.test(line)) {
        state = 'reference';
        html += `<div class="qa-ex-line">${escapeHtml(line)}</div>`;
      } else if (/^＜[^＞]+＞/.test(line)) {
        state = 'none';
        html += `<div class="qa-subheader-line">${escapeHtml(line)}</div>`;
      } else if (/^（例）/.test(line)) {
        html += `<div class="qa-example-line">${escapeHtml(line)}</div>`;
      } else if (/^(第[1-9１-９]章|第[1-9１-９]節|<|\d+[.．]\s|[０-９]+[.．])/.test(line) && line.length < 40) {
        html += `<div class="qa-section-line">${escapeHtml(line)}</div>`;
      } else {
        // Continuation lines — style based on current state
        if (state === 'question') {
          html += `<div class="qa-q-body">${escapeHtml(line)}</div>`;
        } else if (state === 'commentary' || state === 'notes' || state === 'reference') {
          html += `<div class="qa-ex-body">${escapeHtml(line)}</div>`;
        } else {
          html += `<div class="qa-normal-line">${escapeHtml(line)}</div>`;
        }
      }
      i++;
    }
    return html;
  }

  function buildTable(lines, startIdx) {
    const rows = [];
    let i = startIdx;
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      rows.push(cells);
      i++;
    }
    if (rows.length === 0) return '';

    let html = '<table>';
    rows.forEach((row, idx) => {
      html += '<tr>';
      const tag = idx === 0 ? 'th' : 'td';
      row.forEach(cell => {
        html += `<${tag}>${escapeHtml(cell)}</${tag}>`;
      });
      html += '</tr>';
    });
    html += '</table>';
    return html;
  }

  // ==============================
  // Content swiper (解説 ←→ Q&A)
  // ==============================
  function hasAnyQaText(slides) {
    var qaTextAll = getCurrentQaTextAll();
    if (typeof qaTextAll !== 'object') return false;
    return slides.some(s => qaTextAll[s]);
  }

  function getQaTextsForItem(item) {
    var qaTextAll = getCurrentQaTextAll();
    if (typeof qaTextAll !== 'object') return '';
    const qaSlides = (item.slides || []).filter(s => s.startsWith('qa_'));
    const texts = qaSlides.map(s => qaTextAll[s]).filter(Boolean);
    const fullText = texts.join('\n\n');

    // Filter by question numbers if qa_questions is specified
    if (item.qa_questions) {
      if (item.qa_questions.length === 0) return '';
      return filterQaTextByQuestions(fullText, item.qa_questions);
    }
    return fullText;
  }

  function filterQaTextByQuestions(text, questionIds) {
    // Split text into segments at each 問XX boundary
    var parts = text.split(/(?=問\d+(?:-\d+)?[\s　])/);
    var filtered = parts.filter(function(part) {
      var match = part.match(/^問(\d+(?:-\d+)?)[\s　]/);
      return match && questionIds.indexOf(match[1]) !== -1;
    });
    return filtered.map(function(p) {
      // 末尾のセクション見出し行（「2　一日薬価」「9　新薬」「＜...＞」等）を除去
      return p.replace(/(\n+(?:\d+(?:\.\d+)?[\s　][^\n]*|＜[^＞\n]*＞)\s*)+$/, '').trim();
    }).join('\n\n');
  }

  function setupContentSwiper(item) {
    const swiper = document.getElementById('contentSwiper');
    const tabs = document.getElementById('contentTabs');
    const qaPage = document.getElementById('qaTextPage');
    const qaContent = document.getElementById('qaTextContent');
    const memoPageEl = document.getElementById('memoPage');
    const memoTabEl = document.getElementById('memoTab');

    const qaText = getQaTextsForItem(item);
    const hasQa = !!qaText;

    // タブは常に表示。Q&Aなし時はQ&Aタブを無効表示
    tabs.classList.remove('hidden');
    const qaTabEl = tabs.querySelector('[data-page="1"]');
    if (hasQa) {
      qaPage.style.flex = '';
      qaContent.innerHTML = formatQaText(qaText);
      if (qaTabEl) { qaTabEl.style.opacity = '1'; qaTabEl.style.pointerEvents = ''; }
    } else {
      qaPage.style.flex = '0 0 0';
      qaContent.innerHTML = '';
      if (qaTabEl) { qaTabEl.style.opacity = '0.3'; qaTabEl.style.pointerEvents = 'none'; }
    }

    // メモタブは常に表示
    memoPageEl.style.flex = '';
    // メモあり印
    const hasMemo = YakkaStore.hasMemo(item.id);
    memoTabEl.textContent = hasMemo ? 'メモ ✏️' : 'メモ';

    // Tab click
    const tabEls = tabs.querySelectorAll('.content-tab');
    tabEls.forEach(tab => {
      tab.onclick = () => {
        const pageIdx = parseInt(tab.dataset.page);
        swiper.scrollTo({ left: pageIdx * swiper.clientWidth, behavior: 'smooth' });
      };
    });

    // Sync tabs on scroll
    swiper.onscroll = () => {
      const ratio = swiper.scrollLeft / swiper.clientWidth;
      const activeIdx = Math.round(ratio);
      tabEls.forEach((tab, idx) => {
        tab.classList.toggle('active', idx === activeIdx);
      });
    };

    // Reset to first page
    swiper.scrollLeft = 0;
    tabEls.forEach((tab, idx) => tab.classList.toggle('active', idx === 0));
  }

  // ==============================
  // Open/Close answer
  // ==============================
  function openAnswer(idx) {
    currentIndex = idx;
    const item = filteredItems[idx];
    if (!item) return;

    YakkaStore.recordView(item.id);

    document.getElementById('overlayBreadcrumb').textContent = item.breadcrumb || item.section;
    document.getElementById('overlayTitle').textContent = trimTitle(item.title);
    document.getElementById('answerText').innerHTML = formatAnswer(item.answer);

    setupContentSwiper(item);
    renderSlides(item);
    updateAssessmentBar(item.id);
    loadMemoToOverlay(item.id);

    document.getElementById('overlay').classList.add('open');
    document.getElementById('overlayBody').scrollTop = 0;

    document.getElementById('prevBtn').disabled = idx <= 0;
    document.getElementById('nextBtn').disabled = idx >= filteredItems.length - 1;

    const listItem = document.querySelector(`.q-item[data-idx="${idx}"]`);
    if (listItem) listItem.classList.add('viewed');

    updateProgress();
  }

  function closeAnswer() {
    document.getElementById('overlay').classList.remove('open');
    currentIndex = -1;
    renderList();
  }

  function updateAssessmentBar(itemId) {
    const current = YakkaStore.getAssessment(itemId);
    document.querySelectorAll('.assess-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mark === current);
    });
  }

  // ==============================
  // Memo
  // ==============================
  let memoCurrentItemId = null;
  let memoSaveTimeout = null;

  function loadMemoToOverlay(itemId) {
    memoCurrentItemId = itemId;
    const ta = document.getElementById('memoTextarea');
    const saved = document.getElementById('memoSaved');
    ta.value = YakkaStore.getMemo(itemId);
    saved.textContent = '';
  }

  document.getElementById('memoTextarea').addEventListener('input', () => {
    clearTimeout(memoSaveTimeout);
    document.getElementById('memoSaved').textContent = '...';
    memoSaveTimeout = setTimeout(() => {
      if (memoCurrentItemId !== null) {
        const text = document.getElementById('memoTextarea').value;
        YakkaStore.saveMemo(memoCurrentItemId, text);
        document.getElementById('memoSaved').textContent = '保存済み ✓';
        // メモタブ見出し更新
        const memoTabEl = document.getElementById('memoTab');
        if (memoTabEl) memoTabEl.textContent = text.trim() ? 'メモ ✏️' : 'メモ';
        setTimeout(() => { document.getElementById('memoSaved').textContent = ''; }, 1500);
      }
    }, 600);
  });

  function updateProgress() {
    const total = getCurrentQaData().length;
    const count = YakkaStore.getViewedSet().size;
    document.getElementById('viewCount').textContent = `${count}/${total}`;
    document.getElementById('progressFill').style.width = `${(count / total) * 100}%`;
  }

  // Event listeners
  document.getElementById('closeBtn').addEventListener('click', closeAnswer);
  document.getElementById('overlayBackdrop').addEventListener('click', closeAnswer);

  document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentIndex > 0) openAnswer(currentIndex - 1);
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentIndex < filteredItems.length - 1) openAnswer(currentIndex + 1);
  });

  // Assessment buttons
  document.querySelectorAll('.assess-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentIndex < 0) return;
      const item = filteredItems[currentIndex];
      const current = YakkaStore.getAssessment(item.id);
      const mark = btn.dataset.mark;
      YakkaStore.setAssessment(item.id, current === mark ? null : mark);
      updateAssessmentBar(item.id);
    });
  });

  // Filter buttons
  document.getElementById('filterBar').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;

    const qaAllView = document.getElementById('qaAllView');
    const questionList = document.getElementById('questionList');

    if (currentFilter === 'qa-all') {
      questionList.style.display = 'none';
      qaAllView.style.display = '';
      renderQaAllView();
    } else {
      qaAllView.style.display = 'none';
      questionList.style.display = '';
      renderList();
    }
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  let searchTimeout;

  function updateSearchClear() {
    searchClear.classList.toggle('visible', searchInput.value.length > 0);
  }

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    updateSearchClear();
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      renderList();
    }, 200);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    updateSearchClear();
    renderList();
    searchInput.focus();
  });

  // Swipe down to close overlay — ドラッグハンドル部分のみ有効
  let touchStartY = 0;
  const dragHandle = document.getElementById('dragHandle');
  dragHandle.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  dragHandle.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientY - touchStartY;
    if (diff > 60) closeAnswer();
  });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('overlay').classList.contains('open')) return;
    if (e.key === 'Escape') closeAnswer();
    if (e.key === 'ArrowLeft' && currentIndex > 0) openAnswer(currentIndex - 1);
    if (e.key === 'ArrowRight' && currentIndex < filteredItems.length - 1) openAnswer(currentIndex + 1);
  });

  // ==============================
  // Slide rendering (image carousel only)
  // ==============================
  let currentSlideIdx = 0;
  let currentSlides = [];

  function getSlideSource(filename) {
    if (filename.startsWith('henkou_')) return '2026年の変更点';
    if (filename.startsWith('jyuuyou_')) return '算定時の重要な情報';
    if (filename.startsWith('hiyo_')) return '費用対効果制度の情報';
    if (filename.startsWith('beppyo_')) return '別表';
    if (filename.startsWith('ruiji2_')) return '類似薬効比較方式(Ⅱ)';
    if (filename.startsWith('r6kaitei_')) return '2024年次改訂分';
    if (filename.startsWith('qa_')) return '薬価算定の基準 Q&A';
    return '';
  }

  function renderSlides(item) {
    const container = document.getElementById('slidesSection');
    // qa_ prefixed entries are virtual keys for Q&A text lookup only; exclude from image display
    currentSlides = (item.slides || []).filter(s => !s.startsWith('qa_'));
    currentSlideIdx = 0;

    if (currentSlides.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="slides-header">
        関連スライド
        <span class="slides-counter" id="slidesCounter">1 / ${currentSlides.length}</span>
      </div>
      <div class="slide-carousel">
        <div class="slide-img-wrapper">
          <img id="slideImg" src="slides/${currentSlides[0]}" alt="スライド" loading="lazy">
        </div>
        <div class="slide-nav">
          <button class="slide-nav-btn" id="slidePrev" ${currentSlides.length <= 1 ? 'disabled' : ''}>&lsaquo;</button>
          <span class="slide-page" id="slidePage">1 / ${currentSlides.length}</span>
          <button class="slide-nav-btn" id="slideNext" ${currentSlides.length <= 1 ? 'disabled' : ''}>&rsaquo;</button>
        </div>
        <div class="slide-source" id="slideSource">${getSlideSource(currentSlides[0])}</div>
      </div>`;

    document.getElementById('slidePrev').addEventListener('click', () => navigateSlide(-1));
    document.getElementById('slideNext').addEventListener('click', () => navigateSlide(1));
    document.getElementById('slideImg').addEventListener('click', () => openImgViewer());
  }

  function navigateSlide(dir) {
    currentSlideIdx += dir;
    if (currentSlideIdx < 0) currentSlideIdx = 0;
    if (currentSlideIdx >= currentSlides.length) currentSlideIdx = currentSlides.length - 1;

    const filename = currentSlides[currentSlideIdx];
    document.getElementById('slideImg').src = 'slides/' + filename;
    document.getElementById('slidePage').textContent = `${currentSlideIdx + 1} / ${currentSlides.length}`;
    document.getElementById('slidesCounter').textContent = `${currentSlideIdx + 1} / ${currentSlides.length}`;
    document.getElementById('slideSource').textContent = getSlideSource(filename);
    document.getElementById('slidePrev').disabled = currentSlideIdx <= 0;
    document.getElementById('slideNext').disabled = currentSlideIdx >= currentSlides.length - 1;
  }

  // ==============================
  // Pinch-to-zoom for image viewer
  // ==============================
  let pzScale = 1, pzTransX = 0, pzTransY = 0;
  let pzPinchStartDist = 0, pzPinchStartScale = 1;
  let pzPanStart = null, pzPanOriginX = 0, pzPanOriginY = 0;

  function pzApply() {
    const img = document.getElementById('imgViewerImg');
    img.style.transform = `translate(${pzTransX}px, ${pzTransY}px) scale(${pzScale})`;
  }

  function pzReset() {
    pzScale = 1; pzTransX = 0; pzTransY = 0;
    pzApply();
  }

  function pzGetDist(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  const imgViewer = document.getElementById('imgViewer');
  imgViewer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pzPinchStartDist = pzGetDist(e.touches);
      pzPinchStartScale = pzScale;
      pzPanStart = null;
    } else if (e.touches.length === 1 && pzScale > 1.05) {
      pzPanStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      pzPanOriginX = pzTransX;
      pzPanOriginY = pzTransY;
    }
  }, { passive: false });

  imgViewer.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = pzGetDist(e.touches);
      pzScale = Math.min(5, Math.max(0.5, pzPinchStartScale * (dist / pzPinchStartDist)));
      pzApply();
    } else if (e.touches.length === 1 && pzPanStart && pzScale > 1.05) {
      e.preventDefault();
      pzTransX = pzPanOriginX + (e.touches[0].clientX - pzPanStart.x);
      pzTransY = pzPanOriginY + (e.touches[0].clientY - pzPanStart.y);
      pzApply();
    }
  }, { passive: false });

  imgViewer.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pzPanStart = null;
    if (e.touches.length === 0 && pzScale < 1.05) pzReset();
  });

  // ダブルタップでリセット
  let pzLastTap = 0;
  imgViewer.addEventListener('touchend', (e) => {
    if (e.changedTouches.length !== 1) return;
    const now = Date.now();
    if (now - pzLastTap < 300) {
      pzScale === 1 ? (pzScale = 2, pzApply()) : pzReset();
    }
    pzLastTap = now;
  });

  function openImgViewer() {
    const viewer = document.getElementById('imgViewer');
    document.getElementById('imgViewerImg').src = 'slides/' + currentSlides[currentSlideIdx];
    pzReset();
    viewer.classList.add('open');
  }

  document.getElementById('imgViewerClose').addEventListener('click', () => {
    document.getElementById('imgViewer').classList.remove('open');
    pzReset();
  });
  document.getElementById('imgViewer').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('imgViewer').classList.remove('open');
      pzReset();
    }
  });

  // Deep link support: #item-{id}
  function handleDeepLink() {
    const hash = location.hash;
    const m = hash.match(/^#item-(\d+)$/);
    if (!m) return;
    const targetId = parseInt(m[1]);
    const idx = filteredItems.findIndex(item => item.id === targetId);
    if (idx >= 0) openAnswer(idx);
  }

  // Initial render
  renderList();
  handleDeepLink();

  // Scroll-to-top button: show when scrolled down
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  window.addEventListener('scroll', () => {
    if (scrollTopBtn) {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 200);
    }
  }, { passive: true });

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
})();
