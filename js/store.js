/**
 * YakkaStore - localStorage abstraction for study tracking
 * Keys: yakka_items (per-item stats), yakka_daily (daily log)
 */
window.YakkaStore = (function() {
  const ITEMS_KEY = 'yakka_items';
  const DAILY_KEY = 'yakka_daily';
  const OLD_KEY = 'yakka_viewed';
  const MEMOS_KEY = 'yakka_memos';

  function loadMemos() {
    return JSON.parse(localStorage.getItem(MEMOS_KEY) || '{}');
  }
  function saveMemos(memos) {
    localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
  }

  function loadItems() {
    return JSON.parse(localStorage.getItem(ITEMS_KEY) || '{}');
  }

  function saveItems(items) {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  }

  function loadDaily() {
    return JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
  }

  function saveDaily(daily) {
    localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  // Migrate from old yakka_viewed format
  function migrate() {
    const old = localStorage.getItem(OLD_KEY);
    if (!old) return;
    try {
      const ids = JSON.parse(old);
      if (Array.isArray(ids) && ids.length > 0) {
        const items = loadItems();
        ids.forEach(id => {
          if (!items[id]) {
            items[id] = { viewCount: 1, lastViewed: null, assessment: null };
          }
        });
        saveItems(items);
      }
    } catch(e) {}
    localStorage.removeItem(OLD_KEY);
  }

  migrate();

  return {
    recordView(itemId) {
      const items = loadItems();
      if (!items[itemId]) {
        items[itemId] = { viewCount: 0, lastViewed: null, assessment: null };
      }
      items[itemId].viewCount++;
      items[itemId].lastViewed = new Date().toISOString();
      saveItems(items);

      const daily = loadDaily();
      const today = todayStr();
      if (!daily[today]) daily[today] = { count: 0 };
      daily[today].count++;
      saveDaily(daily);
    },

    setAssessment(itemId, mark) {
      const items = loadItems();
      if (!items[itemId]) {
        items[itemId] = { viewCount: 0, lastViewed: null, assessment: null };
      }
      items[itemId].assessment = mark;
      saveItems(items);
    },

    getAssessment(itemId) {
      const items = loadItems();
      return items[itemId] ? items[itemId].assessment : null;
    },

    getItemStats(itemId) {
      const items = loadItems();
      return items[itemId] || { viewCount: 0, lastViewed: null, assessment: null };
    },

    getAllItemStats() {
      return loadItems();
    },

    getDailyLog() {
      return loadDaily();
    },

    getViewedSet() {
      const items = loadItems();
      const s = new Set();
      Object.keys(items).forEach(id => {
        if (items[id].viewCount > 0) s.add(Number(id));
      });
      return s;
    },

    getTotalViews() {
      const items = loadItems();
      return Object.values(items).reduce((sum, v) => sum + v.viewCount, 0);
    },

    getStudyDays() {
      return Object.keys(loadDaily()).length;
    },

    getStreak() {
      const daily = loadDaily();
      const dates = Object.keys(daily).sort().reverse();
      if (dates.length === 0) return 0;

      const today = todayStr();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      if (dates[0] !== today && dates[0] !== yesterday) return 0;

      let streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diff = (prev - curr) / 86400000;
        if (diff === 1) streak++;
        else break;
      }
      return streak;
    },

    getChapterStats(qaData) {
      const items = loadItems();
      const chapters = {};

      qaData.forEach(q => {
        let ch = '他';
        if (q.section.includes('第１章')) ch = '第１章';
        else if (q.section.includes('第２章')) ch = '第２章';
        else if (q.section.includes('第３章')) ch = '第３章';
        else if (q.section.includes('第４章')) ch = '第４章';

        if (!chapters[ch]) {
          chapters[ch] = { total: 0, viewed: 0, totalViews: 0, assessments: { '○': 0, '△': 0, '×': 0, none: 0 } };
        }
        chapters[ch].total++;
        const stat = items[q.id];
        if (stat && stat.viewCount > 0) {
          chapters[ch].viewed++;
          chapters[ch].totalViews += stat.viewCount;
        }
        const assess = stat ? stat.assessment : null;
        if (assess === '○' || assess === '△' || assess === '×') {
          chapters[ch].assessments[assess]++;
        } else {
          chapters[ch].assessments.none++;
        }
      });

      return chapters;
    },

    getWeakItems(qaData, n) {
      const items = loadItems();
      const scored = qaData.map(q => {
        const stat = items[q.id] || { viewCount: 0, assessment: null };
        // Priority: × first, then △, then low view count
        let score = stat.viewCount * 10;
        if (stat.assessment === '×') score -= 1000;
        else if (stat.assessment === '△') score -= 500;
        return { ...q, viewCount: stat.viewCount, assessment: stat.assessment, score };
      });
      scored.sort((a, b) => a.score - b.score);
      return scored.slice(0, n);
    },

    getMemo(itemId) {
      return loadMemos()[itemId] || '';
    },

    saveMemo(itemId, text) {
      const memos = loadMemos();
      if (text.trim() === '') {
        delete memos[itemId];
      } else {
        memos[itemId] = text;
      }
      saveMemos(memos);
    },

    hasMemo(itemId) {
      const memos = loadMemos();
      return !!memos[itemId] && memos[itemId].trim().length > 0;
    },

    getAllMemos() {
      return loadMemos();
    },

    exportMemos() {
      return JSON.stringify(loadMemos(), null, 2);
    },

    importMemos(jsonStr) {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid format');
      saveMemos(parsed);
    },

    getCalendarData(months) {
      const daily = loadDaily();
      const result = [];
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

      for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, count: daily[key] ? daily[key].count : 0 });
      }
      return result;
    }
  };
})();
