/**
 * Q&Aテキスト構造化パーサー
 *
 * Q&Aテキストを「問」「答」「解説」「注」「参考」に分離し、
 * 構造化データとして返す。Word出力やテキスト出力に利用。
 */
var QaParser = (function() {
  'use strict';

  /**
   * Q&Aテキスト全体をパースし、構造化された問の配列を返す
   * @param {string} text - Q&Aテキスト（getQaTextsForItemの返り値等）
   * @returns {Array<Object>} パース結果の配列
   *   各要素: { id: '62-2', question: '...', answer: '...', commentary: '...', notes: '...', reference: '...' }
   */
  function parseQaText(text) {
    if (!text) return [];

    // 問XX の境界で分割
    var parts = text.split(/(?=問\d+(?:-\d+)?[\s　])/);
    var results = [];

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;

      // 問番号を取得
      var idMatch = part.match(/^問(\d+(?:-\d+)?)[\s　]/);
      if (!idMatch) continue;

      var entry = {
        id: idMatch[1],
        fullId: '問' + idMatch[1],
        question: '',
        answer: '',
        commentary: '',   // 解説
        notes: '',         // 注
        reference: ''      // 参考
      };

      // 問番号を除いたテキスト
      var body = part.substring(idMatch[0].length).trim();

      // （答）で分割
      var answerSplit = body.split(/（答）/);
      entry.question = answerSplit[0].trim();

      if (answerSplit.length > 1) {
        var afterAnswer = answerSplit.slice(1).join('（答）');

        // （解説）を分離
        var commentarySplit = afterAnswer.split(/（解説）/);
        var answerPart = commentarySplit[0];

        if (commentarySplit.length > 1) {
          entry.commentary = commentarySplit.slice(1).join('（解説）').trim();
        }

        // （注）を分離（答の部分から）
        var notesSplit = answerPart.split(/（注）/);
        answerPart = notesSplit[0];
        if (notesSplit.length > 1) {
          entry.notes = notesSplit.slice(1).join('（注）').trim();
          // 解説が注の中に含まれている場合
          if (entry.notes.indexOf('（解説）') !== -1) {
            var nc = entry.notes.split(/（解説）/);
            entry.notes = nc[0].trim();
            if (!entry.commentary) {
              entry.commentary = nc.slice(1).join('（解説）').trim();
            }
          }
        }

        // （参考）を分離
        var refSplit = answerPart.split(/（参考）/);
        answerPart = refSplit[0];
        if (refSplit.length > 1) {
          entry.reference = refSplit.slice(1).join('（参考）').trim();
        }

        entry.answer = answerPart.trim();
      }

      results.push(entry);
    }

    return results;
  }

  /**
   * data.jsの1アイテムに対応するQ&Aを構造化して返す
   * @param {Object} item - QA_DATAの1要素
   * @param {Object} qaTextAll - QA_TEXT_ALLオブジェクト
   * @returns {Array<Object>} パース結果
   */
  function parseItemQa(item, qaTextAll) {
    if (!item || !qaTextAll) return [];

    var qaSlides = (item.slides || []).filter(function(s) { return s.startsWith('qa_'); });
    var texts = qaSlides.map(function(s) { return qaTextAll[s]; }).filter(Boolean);
    var fullText = texts.join('\n\n');

    // qa_questionsでフィルタ
    if (item.qa_questions) {
      if (item.qa_questions.length === 0) return [];
      var parts = fullText.split(/(?=問\d+(?:-\d+)?[\s　])/);
      var filtered = parts.filter(function(part) {
        var match = part.match(/^問(\d+(?:-\d+)?)[\s　]/);
        return match && item.qa_questions.indexOf(match[1]) !== -1;
      });
      fullText = filtered.map(function(p) { return p.trim(); }).join('\n\n');
    }

    return parseQaText(fullText);
  }

  /**
   * パース結果を元画像レイアウト風のテキストとして出力
   * @param {Array<Object>} parsed - parseQaTextの返り値
   * @returns {string} フォーマットされたテキスト
   */
  function formatAsOriginalLayout(parsed) {
    var lines = [];

    for (var i = 0; i < parsed.length; i++) {
      var entry = parsed[i];
      lines.push(entry.fullId + '　' + entry.question);
      if (entry.answer) {
        lines.push('（答）' + entry.answer);
      }
      if (entry.notes) {
        lines.push('（注）' + entry.notes);
      }
      if (entry.reference) {
        lines.push('（参考）' + entry.reference);
      }
      if (entry.commentary) {
        lines.push('（解説）' + entry.commentary);
      }
      lines.push(''); // 空行
    }

    return lines.join('\n');
  }

  /**
   * 解説のみを抽出して出力
   * @param {Array<Object>} parsed - parseQaTextの返り値
   * @returns {string} 解説テキスト
   */
  function extractCommentary(parsed) {
    var lines = [];

    for (var i = 0; i < parsed.length; i++) {
      var entry = parsed[i];
      if (entry.commentary) {
        lines.push(entry.fullId + '（解説）');
        lines.push(entry.commentary);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * 全アイテムのQ&Aを構造化して返す
   * @param {Array} qaData - QA_DATA配列
   * @param {Object} qaTextAll - QA_TEXT_ALLオブジェクト
   * @returns {Array<Object>} 各アイテムの構造化Q&A
   *   各要素: { item: {...}, questions: [...] }
   */
  function parseAll(qaData, qaTextAll) {
    var results = [];

    for (var i = 0; i < qaData.length; i++) {
      var item = qaData[i];
      var questions = parseItemQa(item, qaTextAll);
      if (questions.length > 0) {
        results.push({
          item: {
            id: item.id,
            section: item.section,
            title: item.title,
            breadcrumb: item.breadcrumb
          },
          questions: questions
        });
      }
    }

    return results;
  }

  return {
    parseQaText: parseQaText,
    parseItemQa: parseItemQa,
    parseAll: parseAll,
    formatAsOriginalLayout: formatAsOriginalLayout,
    extractCommentary: extractCommentary
  };
})();
