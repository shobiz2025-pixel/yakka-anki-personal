(function() {
  function trimTitle(title) {
    const leadMatch = title.match(/^(?:（[０-９0-9]+）|[０-９0-9]+\s)/);
    const start = leadMatch ? leadMatch[0].length : 0;
    const rest = title.substring(start);
    const m = rest.match(/（(?![０-９0-9ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+）)/);
    if (m) return title.substring(0, start + m.index).replace(/\s+$/, '');
    return title;
  }

  function getChapterKey(section) {
    if (section.includes('第１章')) return '第１章';
    if (section.includes('第２章')) return '第２章';
    if (section.includes('第５節 再算定')) return '第５節 再算定';
    if (section.includes('第３章')) return '第３章';
    if (section.includes('第４章')) return '第４章';
    return '他';
  }

  function getChapterLabel(key) {
    const labels = {
      '第１章': '第１章 定義',
      '第２章': '第２章 新規収載品',
      '第５節 再算定': '第５節 再算定',
      '第３章': '第３章 既収載品',
      '第４章': '第４章 実施時期等'
    };
    return labels[key] || key;
  }

  function getChClass(key) {
    const map = { '第１章': 'ch1', '第２章': 'ch2', '第５節 再算定': 'ch3', '第３章': 'ch3', '第４章': 'ch4' };
    return map[key] || '';
  }

  function getAssessClass(mark) {
    if (mark === '○') return 'dot-good';
    if (mark === '△') return 'dot-shaky';
    if (mark === '×') return 'dot-bad';
    return 'dot-none';
  }

  // Summary cards
  function renderSummary() {
    const totalViews = YakkaStore.getTotalViews();
    const studyDays = YakkaStore.getStudyDays();
    const streak = YakkaStore.getStreak();

    document.getElementById('summaryCards').innerHTML = `
      <div class="summary-card">
        <div class="value">${totalViews}</div>
        <div class="label">総閲覧回数</div>
      </div>
      <div class="summary-card">
        <div class="value">${studyDays}</div>
        <div class="label">学習日数</div>
      </div>
      <div class="summary-card">
        <div class="value">${streak}</div>
        <div class="label">連続日数</div>
      </div>`;
  }

  // Chapter progress
  function renderChapterProgress() {
    const stats = YakkaStore.getChapterStats(QA_DATA);
    const container = document.getElementById('chapterProgress');
    const order = ['第１章', '第２章', '第５節 再算定', '第３章', '第４章'];
    let html = '';

    order.forEach(key => {
      const s = stats[key];
      if (!s) return;
      const pct = s.total > 0 ? Math.round((s.viewed / s.total) * 100) : 0;
      const avg = s.viewed > 0 ? (s.totalViews / s.viewed).toFixed(1) : '0';
      const ch = getChClass(key);

      html += `
        <div class="chapter-card">
          <div class="chapter-card-header">
            <span class="chapter-name ${ch}">${getChapterLabel(key)}</span>
            <span class="chapter-pct">${pct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-track-fill ${ch}" style="width:${pct}%"></div>
          </div>
          <div class="chapter-detail">${s.viewed}/${s.total} 項目閲覧済み・平均 ${avg} 回</div>
          <div class="assess-mini">
            <span class="dot-good">○ ${s.assessments['○']}</span>
            <span class="dot-shaky">△ ${s.assessments['△']}</span>
            <span class="dot-bad">× ${s.assessments['×']}</span>
            <span class="dot-none">未 ${s.assessments.none}</span>
          </div>
        </div>`;
    });

    container.innerHTML = html;
  }

  // Calendar heatmap
  function renderCalendar() {
    const data = YakkaStore.getCalendarData(3);
    const grid = document.getElementById('calendarGrid');

    if (data.length === 0) {
      grid.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:8px">まだ学習データがありません</div>';
      return;
    }

    // Pad to start on Sunday
    const firstDate = new Date(data[0].date);
    const startDay = firstDate.getDay();
    const padded = [];
    for (let i = 0; i < startDay; i++) padded.push({ date: '', count: -1 });
    padded.push(...data);

    // Build weeks
    const weeks = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }

    let html = '';
    weeks.forEach(week => {
      html += '<div class="calendar-week">';
      for (let d = 0; d < 7; d++) {
        const cell = week[d];
        if (!cell || cell.count < 0) {
          html += '<div class="calendar-cell" style="visibility:hidden"></div>';
        } else {
          const lv = cell.count === 0 ? '' :
                     cell.count <= 3 ? ' lv1' :
                     cell.count <= 8 ? ' lv2' :
                     cell.count <= 15 ? ' lv3' : ' lv4';
          html += `<div class="calendar-cell${lv}" title="${cell.date}: ${cell.count}回"></div>`;
        }
      }
      html += '</div>';
    });

    grid.innerHTML = html;
  }

  // Weak items
  function renderWeakItems() {
    const weak = YakkaStore.getWeakItems(QA_DATA, 10);
    const container = document.getElementById('weakItems');

    if (weak.length === 0) {
      container.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:8px">データがありません</div>';
      return;
    }

    let html = '';
    weak.forEach((item, i) => {
      const ch = getChapterKey(item.section);
      const assessMark = item.assessment || '';
      const assessCls = getAssessClass(item.assessment);
      html += `
        <div class="item-row" onclick="location.href='index.html#item-${item.id}'">
          <div class="item-rank">${i + 1}</div>
          <div class="item-info">
            <div class="item-title">${trimTitle(item.title)}</div>
            <div class="item-chapter">${getChapterLabel(ch)}</div>
          </div>
          <div class="item-stats">
            <div class="item-count">${item.viewCount}回</div>
            <div class="item-assess ${assessCls}">${assessMark}</div>
          </div>
        </div>`;
    });

    container.innerHTML = html;
  }

  // Ranking
  function renderRanking() {
    const allStats = YakkaStore.getAllItemStats();
    const ranked = QA_DATA.map(q => {
      const s = allStats[q.id] || { viewCount: 0, assessment: null };
      return { ...q, viewCount: s.viewCount, assessment: s.assessment };
    }).filter(q => q.viewCount > 0)
      .sort((a, b) => b.viewCount - a.viewCount);

    const container = document.getElementById('rankingItems');

    if (ranked.length === 0) {
      container.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:8px">まだ閲覧データがありません</div>';
      return;
    }

    const showInitial = 10;
    let html = '';

    ranked.forEach((item, i) => {
      const ch = getChapterKey(item.section);
      const assessMark = item.assessment || '';
      const assessCls = getAssessClass(item.assessment);
      const hidden = i >= showInitial ? ' style="display:none" data-extra' : '';
      html += `
        <div class="item-row"${hidden} onclick="location.href='index.html#item-${item.id}'">
          <div class="item-rank">${i + 1}</div>
          <div class="item-info">
            <div class="item-title">${trimTitle(item.title)}</div>
            <div class="item-chapter">${getChapterLabel(ch)}</div>
          </div>
          <div class="item-stats">
            <div class="item-count">${item.viewCount}回</div>
            <div class="item-assess ${assessCls}">${assessMark}</div>
          </div>
        </div>`;
    });

    if (ranked.length > showInitial) {
      html += `<button class="show-more-btn" id="showMoreBtn">すべて表示（${ranked.length}件）</button>`;
    }

    container.innerHTML = html;

    const moreBtn = document.getElementById('showMoreBtn');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        container.querySelectorAll('[data-extra]').forEach(el => el.style.display = '');
        moreBtn.remove();
      });
    }
  }

  // Reset
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('学習データをすべてリセットしますか？\nこの操作は取り消せません。')) {
      localStorage.removeItem('yakka_items');
      localStorage.removeItem('yakka_daily');
      localStorage.removeItem('yakka_viewed');
      location.reload();
    }
  });

  // Render all
  renderSummary();
  renderChapterProgress();
  renderCalendar();
  renderWeakItems();
  renderRanking();

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
})();
