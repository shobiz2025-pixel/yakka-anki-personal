/**
 * Word (docx) エクスポートモジュール
 *
 * Q&Aデータ、解説データをWord形式でダウンロードする。
 * HTML→Blob→.doc 方式で、外部ライブラリ不要。
 * Word は HTML 形式の .doc ファイルを正しく開ける。
 */
var WordExport = (function() {
  'use strict';

  // Word向けHTML文書のヘッダ
  function getDocHeader(title) {
    return '<!DOCTYPE html>' +
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head>' +
      '<meta charset="utf-8">' +
      '<title>' + escHtml(title) + '</title>' +
      '<!--[if gte mso 9]>' +
      '<xml><w:WordDocument><w:View>Print</w:View>' +
      '<w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/>' +
      '</w:WordDocument></xml>' +
      '<![endif]-->' +
      '<style>' +
      'body { font-family: "游明朝", "Yu Mincho", serif; font-size: 10.5pt; line-height: 1.6; margin: 2cm; }' +
      'h1 { font-size: 16pt; font-weight: bold; border-bottom: 2pt solid #333; padding-bottom: 4pt; margin-top: 24pt; }' +
      'h2 { font-size: 13pt; font-weight: bold; margin-top: 18pt; color: #1a73e8; }' +
      'h3 { font-size: 11pt; font-weight: bold; margin-top: 12pt; }' +
      '.question-id { font-weight: bold; font-size: 11pt; color: #333; }' +
      '.question-text { margin-left: 0; }' +
      '.answer { margin-left: 1em; }' +
      '.answer-label { font-weight: bold; }' +
      '.commentary { margin-left: 1em; color: #555; background: #f9f9f9; padding: 4pt 8pt; border-left: 3pt solid #1a73e8; }' +
      '.commentary-label { font-weight: bold; color: #1a73e8; }' +
      '.notes { margin-left: 1em; color: #666; font-size: 9.5pt; }' +
      '.reference { margin-left: 1em; color: #666; font-size: 9.5pt; font-style: italic; }' +
      '.section-header { font-size: 14pt; font-weight: bold; background: #e8f0fe; padding: 6pt 12pt; margin-top: 24pt; }' +
      '.item-title { font-size: 11pt; font-weight: bold; margin-top: 16pt; padding: 4pt 0; border-bottom: 1pt solid #ccc; }' +
      '.item-answer { margin: 8pt 0; padding: 8pt; background: #fafafa; }' +
      'table { border-collapse: collapse; margin: 8pt 0; }' +
      'td, th { border: 1pt solid #999; padding: 4pt 8pt; font-size: 9.5pt; }' +
      'th { background: #e8e8e8; }' +
      '.page-break { page-break-before: always; }' +
      '.toc-item { margin: 2pt 0; }' +
      '</style>' +
      '</head><body>';
  }

  var DOC_FOOTER = '</body></html>';

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/\n/g, '<br>');
  }

  function escHtmlKeepBreaks(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/\n/g, '<br>\n');
  }

  /**
   * Blob をダウンロードする
   */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // ====================================================
  // エクスポート1: Q&A全文（元画像レイアウト風）
  // ====================================================
  function exportQaFull(qaData, qaTextAll, versionLabel) {
    var title = '薬価算定の基準 Q&A (' + versionLabel + ')';
    var html = getDocHeader(title);

    html += '<h1>' + escHtml(title) + '</h1>';
    html += '<p>出力日: ' + new Date().toLocaleDateString('ja-JP') + '</p>';

    var allParsed = QaParser.parseAll(qaData, qaTextAll);
    var lastSection = '';

    for (var i = 0; i < allParsed.length; i++) {
      var entry = allParsed[i];
      var item = entry.item;

      // セクション見出し
      if (item.section !== lastSection) {
        html += '<div class="section-header">' + escHtml(item.section) + '</div>';
        lastSection = item.section;
      }

      // アイテムタイトル
      html += '<div class="item-title">' + escHtml(item.title) + '</div>';

      // Q&A
      for (var j = 0; j < entry.questions.length; j++) {
        var q = entry.questions[j];
        html += '<div style="margin: 8pt 0;">';
        html += '<span class="question-id">' + escHtml(q.fullId) + '</span>　';
        html += '<span class="question-text">' + escHtmlKeepBreaks(q.question) + '</span>';

        if (q.answer) {
          html += '<div class="answer"><span class="answer-label">（答）</span>' + escHtmlKeepBreaks(q.answer) + '</div>';
        }
        if (q.notes) {
          html += '<div class="notes">（注）' + escHtmlKeepBreaks(q.notes) + '</div>';
        }
        if (q.reference) {
          html += '<div class="reference">（参考）' + escHtmlKeepBreaks(q.reference) + '</div>';
        }
        if (q.commentary) {
          html += '<div class="commentary"><span class="commentary-label">（解説）</span>' + escHtmlKeepBreaks(q.commentary) + '</div>';
        }
        html += '</div>';
      }
    }

    html += DOC_FOOTER;

    var blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, '薬価算定Q&A_' + versionLabel + '.doc');
  }

  // ====================================================
  // エクスポート2: 解説のみ
  // ====================================================
  function exportCommentaryOnly(qaData, qaTextAll, versionLabel) {
    var title = '薬価算定の基準 Q&A 解説集 (' + versionLabel + ')';
    var html = getDocHeader(title);

    html += '<h1>' + escHtml(title) + '</h1>';
    html += '<p>出力日: ' + new Date().toLocaleDateString('ja-JP') + '</p>';

    var allParsed = QaParser.parseAll(qaData, qaTextAll);
    var lastSection = '';
    var commentaryCount = 0;

    for (var i = 0; i < allParsed.length; i++) {
      var entry = allParsed[i];
      var item = entry.item;
      var hasCommentary = entry.questions.some(function(q) { return !!q.commentary; });
      if (!hasCommentary) continue;

      if (item.section !== lastSection) {
        html += '<div class="section-header">' + escHtml(item.section) + '</div>';
        lastSection = item.section;
      }

      html += '<div class="item-title">' + escHtml(item.title) + '</div>';

      for (var j = 0; j < entry.questions.length; j++) {
        var q = entry.questions[j];
        if (!q.commentary) continue;
        commentaryCount++;

        html += '<div style="margin: 8pt 0;">';
        html += '<span class="question-id">' + escHtml(q.fullId) + '</span>　';
        html += '<span class="question-text">' + escHtmlKeepBreaks(q.question) + '</span>';
        html += '<div class="answer"><span class="answer-label">（答）</span>' + escHtmlKeepBreaks(q.answer) + '</div>';
        html += '<div class="commentary"><span class="commentary-label">（解説）</span>' + escHtmlKeepBreaks(q.commentary) + '</div>';
        html += '</div>';
      }
    }

    if (commentaryCount === 0) {
      html += '<p>解説が含まれるQ&Aはありませんでした。</p>';
    }

    html += DOC_FOOTER;

    var blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, '薬価算定Q&A_解説集_' + versionLabel + '.doc');
  }

  // ====================================================
  // エクスポート3: 基準本文（data.jsのanswer）
  // ====================================================
  function exportKijunText(qaData, versionLabel) {
    var title = '薬価算定の基準 本文 (' + versionLabel + ')';
    var html = getDocHeader(title);

    html += '<h1>' + escHtml(title) + '</h1>';
    html += '<p>出力日: ' + new Date().toLocaleDateString('ja-JP') + '</p>';

    var lastSection = '';

    for (var i = 0; i < qaData.length; i++) {
      var item = qaData[i];

      if (item.section !== lastSection) {
        if (lastSection) html += '<div class="page-break"></div>';
        html += '<div class="section-header">' + escHtml(item.section) + '</div>';
        lastSection = item.section;
      }

      html += '<div class="item-title">' + escHtml(item.title) + '</div>';
      html += '<div class="item-answer">' + escHtmlKeepBreaks(item.answer) + '</div>';
    }

    html += DOC_FOOTER;

    var blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, '薬価算定の基準_' + versionLabel + '.doc');
  }

  // ====================================================
  // エクスポート4: 特定章のQ&A
  // ====================================================
  function exportChapterQa(qaData, qaTextAll, chapterFilter, versionLabel) {
    var filtered = qaData.filter(function(item) {
      return item.section.indexOf(chapterFilter) !== -1;
    });

    var chapterName = chapterFilter || 'すべて';
    var title = '薬価算定 Q&A ' + chapterName + ' (' + versionLabel + ')';
    var html = getDocHeader(title);

    html += '<h1>' + escHtml(title) + '</h1>';
    html += '<p>出力日: ' + new Date().toLocaleDateString('ja-JP') + '</p>';

    var allParsed = QaParser.parseAll(filtered, qaTextAll);

    for (var i = 0; i < allParsed.length; i++) {
      var entry = allParsed[i];
      html += '<div class="item-title">' + escHtml(entry.item.title) + '</div>';

      for (var j = 0; j < entry.questions.length; j++) {
        var q = entry.questions[j];
        html += '<div style="margin: 8pt 0;">';
        html += '<span class="question-id">' + escHtml(q.fullId) + '</span>　';
        html += '<span class="question-text">' + escHtmlKeepBreaks(q.question) + '</span>';
        if (q.answer) {
          html += '<div class="answer"><span class="answer-label">（答）</span>' + escHtmlKeepBreaks(q.answer) + '</div>';
        }
        if (q.commentary) {
          html += '<div class="commentary"><span class="commentary-label">（解説）</span>' + escHtmlKeepBreaks(q.commentary) + '</div>';
        }
        html += '</div>';
      }
    }

    html += DOC_FOOTER;

    var blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, '薬価算定Q&A_' + chapterName + '_' + versionLabel + '.doc');
  }

  // ====================================================
  // エクスポート5: 厚生労働省資料風レイアウト（Q&A原本風）
  // ====================================================
  function exportOriginalLayout(qaData, qaTextAll, versionLabel) {
    var title = '『薬価算定の基準』Q&A';
    var html = getDocHeader(title);

    html += '<div style="text-align:right; margin-bottom:12pt;">' + escHtml(versionLabel || '令和8年3月現在') + '</div>';
    html += '<h1 style="text-align:center; border:none;">' + escHtml(title) + '</h1>';
    html += '<p style="text-align:center;">＜本文＞</p>';

    var allParsed = QaParser.parseAll(qaData, qaTextAll);
    var lastSection = '';

    for (var i = 0; i < allParsed.length; i++) {
      var entry = allParsed[i];
      var item = entry.item;

      if (item.section !== lastSection) {
        html += '<h2>' + escHtml(item.section) + '</h2>';
        lastSection = item.section;
      }

      // アイテムの定義番号をそのまま表示
      html += '<h3>' + escHtml(item.title) + '</h3>';

      for (var j = 0; j < entry.questions.length; j++) {
        var q = entry.questions[j];
        html += '<p>';
        html += '<b>' + escHtml(q.fullId) + '</b>　' + escHtmlKeepBreaks(q.question);
        html += '</p>';
        if (q.answer) {
          html += '<p>（答）' + escHtmlKeepBreaks(q.answer) + '</p>';
        }
        if (q.notes) {
          html += '<p style="font-size:9.5pt;">（注）' + escHtmlKeepBreaks(q.notes) + '</p>';
        }
        if (q.reference) {
          html += '<p style="font-size:9.5pt; font-style:italic;">（参考）' + escHtmlKeepBreaks(q.reference) + '</p>';
        }
        if (q.commentary) {
          html += '<p style="color:#555;">（解説）' + escHtmlKeepBreaks(q.commentary) + '</p>';
        }
      }
    }

    html += DOC_FOOTER;

    var blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, '薬価算定Q&A_原本レイアウト_' + versionLabel + '.doc');
  }

  return {
    exportQaFull: exportQaFull,
    exportCommentaryOnly: exportCommentaryOnly,
    exportKijunText: exportKijunText,
    exportChapterQa: exportChapterQa,
    exportOriginalLayout: exportOriginalLayout
  };
})();
