/**
 * 薬価算定 戦略ツール - UI Logic
 */
(function () {
  "use strict";

  let currentAxis = null;       // "unlisted" | "listed"
  let checklistAnswers = {};    // { item_id: value }

  // ── Initialisation ──
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    // Axis selection buttons
    document.getElementById("btnUnlisted").addEventListener("click", () => selectAxis("unlisted"));
    document.getElementById("btnListed").addEventListener("click", () => selectAxis("listed"));
    document.getElementById("axisChangeBtn").addEventListener("click", resetAxis);

    // Tab switching
    document.querySelectorAll(".tool-tab").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Modal close
    document.getElementById("qaModalClose").addEventListener("click", closeQaModal);
    document.getElementById("qaModal").addEventListener("click", e => {
      if (e.target === document.getElementById("qaModal")) closeQaModal();
    });
  }

  // ── Axis Selection ──
  function selectAxis(axis) {
    currentAxis = axis;
    checklistAnswers = { listing_status: axis };
    document.getElementById("axisSelection").style.display = "none";
    document.getElementById("mainTool").style.display = "block";

    const badge = document.getElementById("axisBadge");
    if (axis === "unlisted") {
      badge.textContent = "未収載品モード";
      badge.className = "axis-badge axis-unlisted";
    } else {
      badge.textContent = "既収載品モード";
      badge.className = "axis-badge axis-listed";
    }

    renderChecklist();
    renderProcess();
    renderComponents();
    renderStrategy();
    switchTab("checklist");
  }

  function resetAxis() {
    currentAxis = null;
    checklistAnswers = {};
    document.getElementById("axisSelection").style.display = "block";
    document.getElementById("mainTool").style.display = "none";
  }

  // ── Tab Switching ──
  function switchTab(tabId) {
    document.querySelectorAll(".tool-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === "tab-" + tabId));
  }

  // ══════════════════════════════════════
  // Checklist Tab
  // ══════════════════════════════════════
  function renderChecklist() {
    const container = document.getElementById("checklistContainer");
    container.innerHTML = "";

    const data = STRATEGY_DATA.checklist;
    const sections = currentAxis === "unlisted"
      ? ["basic", "unlisted", "premiums"]
      : ["basic", "listed"];

    sections.forEach(sectionKey => {
      const section = data[sectionKey];
      if (!section) return;

      // Check section-level condition
      if (section.condition && !matchCondition(section.condition)) return;

      const sectionEl = document.createElement("div");
      sectionEl.className = "checklist-section";
      sectionEl.innerHTML = `<h3 class="checklist-section-title">${section.label}</h3>`;

      section.items.forEach(item => {
        // Check item-level condition
        if (item.condition && !matchCondition(item.condition)) return;

        const itemEl = createChecklistItem(item);
        sectionEl.appendChild(itemEl);
      });

      container.appendChild(sectionEl);
    });

    // Pre-select axis-determined values
    if (currentAxis === "unlisted") {
      setChecklistValue("listing_status", "unlisted");
    } else {
      setChecklistValue("listing_status", "listed");
    }

    updateChecklistSummary();
  }

  function createChecklistItem(item) {
    const div = document.createElement("div");
    div.className = "checklist-item";
    div.dataset.itemId = item.id;

    let inputHtml = "";

    if (item.type === "yesno") {
      inputHtml = `
        <div class="checklist-options">
          <button class="opt-btn" data-id="${item.id}" data-value="yes">はい</button>
          <button class="opt-btn" data-id="${item.id}" data-value="no">いいえ</button>
        </div>`;
    } else if (item.type === "select") {
      const optionsHtml = item.options.map(o =>
        `<button class="opt-btn" data-id="${item.id}" data-value="${o.value}">${o.label}</button>`
      ).join("");
      inputHtml = `<div class="checklist-options">${optionsHtml}</div>`;
    }

    const qaRefHtml = (item.qa_refs && item.qa_refs.length > 0)
      ? `<button class="qa-ref-btn" data-refs='${JSON.stringify(item.qa_refs)}' data-ids='${JSON.stringify(item.data_ids || [])}'>関連Q&A</button>`
      : "";

    const dataIdHtml = (item.data_ids && item.data_ids.length > 0)
      ? `<button class="data-ref-btn" data-ids='${JSON.stringify(item.data_ids)}'>定義を見る</button>`
      : "";

    div.innerHTML = `
      <div class="checklist-question">
        <span class="checklist-q-text">${item.question}</span>
        ${item.required ? '<span class="required-mark">必須</span>' : ""}
      </div>
      ${item.help ? `<div class="checklist-help">${item.help}</div>` : ""}
      ${inputHtml}
      <div class="checklist-refs">${qaRefHtml}${dataIdHtml}</div>
    `;

    // Option button handlers
    div.querySelectorAll(".opt-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        div.querySelectorAll(".opt-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        checklistAnswers[item.id] = btn.dataset.value;
        onChecklistChange();
      });
    });

    // QA ref button handler
    const qaBtn = div.querySelector(".qa-ref-btn");
    if (qaBtn) {
      qaBtn.addEventListener("click", () => {
        const refs = JSON.parse(qaBtn.dataset.refs);
        const ids = JSON.parse(qaBtn.dataset.ids);
        openQaModal(refs, ids);
      });
    }

    // Data ref button handler
    const dataBtn = div.querySelector(".data-ref-btn");
    if (dataBtn) {
      dataBtn.addEventListener("click", () => {
        const ids = JSON.parse(dataBtn.dataset.ids);
        openQaModal([], ids);
      });
    }

    // Restore saved answer
    if (checklistAnswers[item.id]) {
      const saved = div.querySelector(`.opt-btn[data-value="${checklistAnswers[item.id]}"]`);
      if (saved) saved.classList.add("selected");
    }

    return div;
  }

  function setChecklistValue(id, value) {
    checklistAnswers[id] = value;
    const btn = document.querySelector(`.opt-btn[data-id="${id}"][data-value="${value}"]`);
    if (btn) {
      btn.closest(".checklist-options").querySelectorAll(".opt-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    }
  }

  function matchCondition(condition) {
    for (const key in condition) {
      const expected = condition[key];
      const actual = checklistAnswers[key];
      if (Array.isArray(expected)) {
        if (!expected.includes(actual)) return false;
      } else {
        if (actual !== expected) return false;
      }
    }
    return true;
  }

  function onChecklistChange() {
    // Re-render to show/hide conditional items
    renderChecklist();
    updateChecklistSummary();
    // Update other tabs based on checklist
    renderProcess();
  }

  function updateChecklistSummary() {
    const resultEl = document.getElementById("checklistResult");
    const summaryEl = document.getElementById("checklistSummary");

    const answered = Object.keys(checklistAnswers).filter(k => checklistAnswers[k]);
    if (answered.length < 3) {
      resultEl.style.display = "none";
      return;
    }

    resultEl.style.display = "block";
    let html = "<div class='summary-items'>";

    // Pricing method
    if (currentAxis === "unlisted") {
      const cat = checklistAnswers.drug_category;
      const hasSimilar = checklistAnswers.has_similar;

      if (cat === "new_drug" && hasSimilar === "yes") {
        const method = checklistAnswers.similar_method === "method2" ? "類似薬効比較方式（Ⅱ）" : "類似薬効比較方式（Ⅰ）";
        html += summaryCard("算定方式", method, "primary");
      } else if (cat === "new_drug" && hasSimilar === "no") {
        html += summaryCard("算定方式", "原価計算方式", "primary");
      } else if (cat === "generic") {
        html += summaryCard("算定方式", "新規後発品算定（先発品×0.5）", "primary");
      } else if (cat === "biosimilar") {
        html += summaryCard("算定方式", "バイオ後続品算定（先行品×0.7）", "primary");
      } else if (cat === "ag") {
        html += summaryCard("算定方式", "AG算定（先発品×0.5）", "primary");
      }

      // Applicable premiums
      const premiums = [];
      if (checklistAnswers.premium_innovation === "yes") premiums.push("画期性加算（70-120%）");
      if (checklistAnswers.premium_usefulness1 === "yes") premiums.push("有用性加算Ⅰ（35-60%）");
      if (checklistAnswers.premium_usefulness2 === "yes") premiums.push("有用性加算Ⅱ（5-30%）");
      if (checklistAnswers.premium_orphan === "yes") premiums.push("市場性加算Ⅰ（10-20%）");
      if (checklistAnswers.premium_market2 === "yes") premiums.push("市場性加算Ⅱ（5%）");
      if (checklistAnswers.premium_pediatric === "yes") premiums.push("小児加算（5-20%）");
      if (checklistAnswers.premium_pioneer === "yes") premiums.push("先駆加算（5-20%）");
      if (checklistAnswers.premium_rapid === "yes") premiums.push("迅速導入加算（5-20%）");
      if (checklistAnswers.premium_specific === "yes") premiums.push("特定用途加算（5-20%）");

      if (premiums.length > 0) {
        html += summaryCard("該当する補正加算", premiums.join("<br>"), "success");
      } else if (cat === "new_drug") {
        html += summaryCard("補正加算", "該当なし", "neutral");
      }

      // Foreign price adjustment
      if (checklistAnswers.has_foreign_price === "yes_multiple" || checklistAnswers.has_foreign_price === "yes_one") {
        html += summaryCard("外国平均価格調整", "適用あり（0.75倍〜1.5倍）", "warning");
      }

      // Combination / Kit
      if (checklistAnswers.is_combination === "new_combination") {
        html += summaryCard("配合剤特例", "新医療用配合剤の特例による算定", "info");
      }
      if (checklistAnswers.is_kit === "yes") {
        html += summaryCard("キット製品", "キット加算あり", "info");
      }
    }

    if (currentAxis === "listed") {
      // NPC status
      if (checklistAnswers.npc_eligible === "yes") {
        html += summaryCard("新薬創出等加算", "対象品目", "success");
        if (checklistAnswers.npc_cumulative === "yes") {
          html += summaryCard("累積額", "控除リスクあり", "warning");
        }
      }

      // Generic status
      const gs = checklistAnswers.has_generic;
      if (gs === "exists_over80") {
        html += summaryCard("長期収載品", "G1品目（後発品置換率80%以上）", "danger");
      } else if (gs === "exists_under80") {
        const years = checklistAnswers.generic_years;
        if (years === "over12" || years === "10to12") {
          html += summaryCard("長期収載品", "G2品目候補（後発品置換率80%未満）", "warning");
        }
      }

      // Market expansion risk
      if (checklistAnswers.sales_expansion_risk === "high") {
        html += summaryCard("市場拡大再算定", "高リスク", "danger");
      } else if (checklistAnswers.sales_expansion_risk === "medium") {
        html += summaryCard("市場拡大再算定", "中リスク（モニタリング要）", "warning");
      }

      // Efficacy addition
      const ea = checklistAnswers.efficacy_addition_plan;
      if (ea === "orphan") {
        html += summaryCard("効能追加", "希少疾病 → 加算機会あり", "success");
      } else if (ea === "pediatric") {
        html += summaryCard("効能追加", "小児適応 → 加算機会あり", "success");
      } else if (ea === "other") {
        html += summaryCard("効能追加", "効能変化再算定のリスク評価が必要", "warning");
      }

      // True endpoint
      if (checklistAnswers.true_endpoint_data === "yes") {
        html += summaryCard("市販後データ", "薬価改定時の加算の機会あり", "success");
      }
    }

    html += "</div>";
    summaryEl.innerHTML = html;
  }

  function summaryCard(title, content, type) {
    return `<div class="summary-card summary-${type}">
      <div class="summary-card-title">${title}</div>
      <div class="summary-card-content">${content}</div>
    </div>`;
  }

  // ══════════════════════════════════════
  // Process Tab
  // ══════════════════════════════════════
  function renderProcess() {
    const container = document.getElementById("processContainer");
    const steps = currentAxis === "unlisted"
      ? STRATEGY_DATA.pricing_tree.unlisted
      : STRATEGY_DATA.pricing_tree.listed;

    let html = `<h3 class="process-title">${currentAxis === "unlisted" ? "新規収載 算定フロー" : "既収載品 改定フロー"}</h3>`;
    html += '<div class="process-steps">';

    steps.forEach((step, idx) => {
      // For unlisted, filter based on checklist answers
      if (currentAxis === "unlisted" && !shouldShowStep(step)) return;

      const isActive = currentAxis === "unlisted" ? isStepRelevant(step) : true;

      html += `<div class="process-step ${isActive ? "step-active" : "step-dimmed"}">
        <div class="step-number">${idx + 1}</div>
        <div class="step-content">
          <div class="step-title">${step.title}</div>
          <div class="step-desc">${step.description}</div>`;

      if (step.sub_steps) {
        html += '<ul class="step-substeps">';
        step.sub_steps.forEach(s => { html += `<li>${s}</li>`; });
        html += "</ul>";
      }

      if (step.strategic_note) {
        html += `<div class="step-strategy">${step.strategic_note}</div>`;
      }

      if (step.qa_refs && step.qa_refs.length > 0) {
        html += `<button class="qa-ref-btn-inline" data-refs='${JSON.stringify(step.qa_refs)}' data-ids='${JSON.stringify(step.data_ids || [])}'>関連Q&A (${step.qa_refs.length}件)</button>`;
      }

      html += `</div></div>`;
    });

    html += "</div>";
    container.innerHTML = html;

    // Bind QA ref buttons
    container.querySelectorAll(".qa-ref-btn-inline").forEach(btn => {
      btn.addEventListener("click", () => {
        openQaModal(JSON.parse(btn.dataset.refs), JSON.parse(btn.dataset.ids));
      });
    });
  }

  function shouldShowStep(step) {
    // Always show step1 and the main method steps
    if (step.id === "step1") return true;
    const cat = checklistAnswers.drug_category;
    if (!cat) return true;

    if (step.id === "step2_new" && cat === "new_drug") return true;
    if (step.id === "step3_similar" && cat === "new_drug" && checklistAnswers.has_similar === "yes") return true;
    if (step.id === "step3_cost" && cat === "new_drug" && checklistAnswers.has_similar === "no") return true;
    if (step.id === "step_generic" && cat === "generic") return true;
    if (step.id === "step_biosimilar" && cat === "biosimilar") return true;
    if (step.id === "step_ag" && cat === "ag") return true;

    // If no category selected yet, show all
    if (!cat) return true;

    return false;
  }

  function isStepRelevant(step) {
    // Highlight steps that match current checklist answers
    if (!checklistAnswers.drug_category) return true;
    return shouldShowStep(step);
  }

  // ══════════════════════════════════════
  // Components Tab
  // ══════════════════════════════════════
  function renderComponents() {
    const container = document.getElementById("componentsContainer");
    const comps = currentAxis === "unlisted"
      ? STRATEGY_DATA.components.unlisted
      : STRATEGY_DATA.components.listed;

    let html = `<h3 class="comp-title">${currentAxis === "unlisted" ? "新規収載時" : "収載後"} の固定/変動コンポーネント</h3>`;

    // Fixed components
    html += '<div class="comp-section"><h4 class="comp-section-title comp-fixed-title">固定コンポーネント（所与・機械的）</h4>';
    html += '<div class="comp-list">';
    comps.fixed.forEach(c => {
      html += `<div class="comp-card comp-card-fixed">
        <div class="comp-label">${c.label}</div>
        <div class="comp-desc">${c.description}</div>
        ${renderCompRefs(c)}
      </div>`;
    });
    html += "</div></div>";

    // Variable components
    html += '<div class="comp-section"><h4 class="comp-section-title comp-variable-title">変動コンポーネント（戦略の余地あり）</h4>';
    html += '<div class="comp-list">';
    comps.variable.forEach(c => {
      const impClass = c.importance === "critical" ? "imp-critical" : c.importance === "high" ? "imp-high" : "imp-medium";
      html += `<div class="comp-card comp-card-variable ${impClass}">
        <div class="comp-label">${c.label}<span class="imp-badge imp-badge-${c.importance}">${impLabel(c.importance)}</span></div>
        <div class="comp-desc">${c.description}</div>
        ${renderCompRefs(c)}
      </div>`;
    });
    html += "</div></div>";

    container.innerHTML = html;

    // Bind ref buttons
    container.querySelectorAll(".qa-ref-btn-inline").forEach(btn => {
      btn.addEventListener("click", () => {
        openQaModal(JSON.parse(btn.dataset.refs), JSON.parse(btn.dataset.ids));
      });
    });
  }

  function renderCompRefs(c) {
    const refs = c.qa_refs || [];
    const ids = c.data_ids || [];
    if (refs.length === 0 && ids.length === 0) return "";
    return `<button class="qa-ref-btn-inline" data-refs='${JSON.stringify(refs)}' data-ids='${JSON.stringify(ids)}'>関連Q&A</button>`;
  }

  function impLabel(imp) {
    if (imp === "critical") return "最重要";
    if (imp === "high") return "重要";
    return "中";
  }

  // ══════════════════════════════════════
  // Strategy Tab
  // ══════════════════════════════════════
  function renderStrategy() {
    const container = document.getElementById("strategyContainer");
    const strats = currentAxis === "unlisted"
      ? STRATEGY_DATA.strategies.unlisted
      : STRATEGY_DATA.strategies.listed;

    let html = `<h3 class="strategy-title">${currentAxis === "unlisted" ? "薬価最大化戦略（未収載品）" : "薬価維持戦略（既収載品）"}</h3>`;

    strats.forEach(phase => {
      html += `<div class="strategy-phase">
        <h4 class="phase-title">${phase.phase}</h4>
        <div class="strategy-items">`;

      phase.items.forEach(item => {
        const impClass = item.importance === "critical" ? "imp-critical" : item.importance === "high" ? "imp-high" : "imp-medium";
        html += `<div class="strategy-item ${impClass}">
          <div class="strategy-item-title">
            ${item.title}
            <span class="imp-badge imp-badge-${item.importance}">${impLabel(item.importance)}</span>
          </div>
          <div class="strategy-item-desc">${item.description}</div>
        </div>`;
      });

      html += "</div></div>";
    });

    container.innerHTML = html;
  }

  // ══════════════════════════════════════
  // Q&A Reference Modal
  // ══════════════════════════════════════
  function openQaModal(qaRefs, dataIds) {
    const modal = document.getElementById("qaModal");
    const body = document.getElementById("qaModalBody");
    let html = "";

    // Show relevant data.js items
    if (dataIds && dataIds.length > 0) {
      html += '<div class="qa-modal-section"><h4>関連する定義</h4>';
      dataIds.forEach(id => {
        const item = QA_DATA.find(d => d.id === id);
        if (!item) return;
        html += `<div class="qa-modal-item">
          <div class="qa-modal-item-title">${item.title}</div>
          <div class="qa-modal-item-section">${item.section}</div>
          <div class="qa-modal-item-answer">${formatAnswer(item.answer)}</div>
          <a href="index.html#item-${item.id}" class="qa-modal-link" target="_blank">暗記ツールで開く</a>
        </div>`;
      });
      html += "</div>";
    }

    // Show relevant Q&A text
    if (qaRefs && qaRefs.length > 0) {
      html += '<div class="qa-modal-section"><h4>関連Q&A</h4>';

      // Find Q&A text from QA_TEXT_ALL
      const allText = getAllQaText();
      qaRefs.forEach(ref => {
        const found = findQaByNumber(allText, ref);
        if (found) {
          html += `<div class="qa-modal-qa">
            <div class="qa-modal-qa-num">問${ref}</div>
            <div class="qa-modal-qa-text">${formatQaForModal(found)}</div>
          </div>`;
        }
      });

      html += "</div>";
    }

    if (!html) {
      html = "<p>関連データが見つかりませんでした。</p>";
    }

    body.innerHTML = html;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeQaModal() {
    document.getElementById("qaModal").style.display = "none";
    document.body.style.overflow = "";
  }

  function getAllQaText() {
    // Merge all QA_TEXT entries into a single string per key
    if (typeof QA_TEXT_ALL === "undefined") return "";
    let combined = "";
    for (const key in QA_TEXT_ALL) {
      if (QA_TEXT_ALL[key]) combined += QA_TEXT_ALL[key] + "\n\n";
    }
    return combined;
  }

  function findQaByNumber(allText, num) {
    // Extract Q&A block for a specific question number
    const escapedNum = num.replace(/[-]/g, "[-\\s]?");
    const pattern = new RegExp(`問\\s*${escapedNum}[　\\s]([\\s\\S]*?)(?=問\\s*\\d|$)`);
    const match = allText.match(pattern);
    if (match) return match[0].trim();

    // Try simpler match
    const simplePattern = new RegExp(`問${num}[　\\s]([\\s\\S]*?)(?=\\n問\\d|$)`);
    const simpleMatch = allText.match(simplePattern);
    if (simpleMatch) return simpleMatch[0].trim();

    return null;
  }

  function formatAnswer(text) {
    if (!text) return "";
    return text
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  }

  function formatQaForModal(text) {
    if (!text) return "";
    return text
      .replace(/\n/g, "<br>")
      .replace(/（答）/g, "<br><strong>（答）</strong>")
      .replace(/（解説）/g, "<br><strong>（解説）</strong>")
      .replace(/（注）/g, "<br><strong>（注）</strong>");
  }

})();
