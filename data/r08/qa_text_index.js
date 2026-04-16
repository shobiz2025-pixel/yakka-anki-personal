/**
 * 令和8年度版 Q&Aテキスト統合ファイル
 *
 * js/qa_text_r8_01.js 〜 js/qa_text_r8_08.js を統合する。
 * グローバル変数名は QA_TEXT_ALL_R08 とする。
 */

const QA_TEXT_ALL_R08 = Object.assign({},
  typeof QA_TEXT_R8_01 !== 'undefined' ? QA_TEXT_R8_01 : {},
  typeof QA_TEXT_R8_02 !== 'undefined' ? QA_TEXT_R8_02 : {},
  typeof QA_TEXT_R8_03 !== 'undefined' ? QA_TEXT_R8_03 : {},
  typeof QA_TEXT_R8_04 !== 'undefined' ? QA_TEXT_R8_04 : {},
  typeof QA_TEXT_R8_05 !== 'undefined' ? QA_TEXT_R8_05 : {},
  typeof QA_TEXT_R8_06 !== 'undefined' ? QA_TEXT_R8_06 : {},
  typeof QA_TEXT_R8_07 !== 'undefined' ? QA_TEXT_R8_07 : {},
  typeof QA_TEXT_R8_08 !== 'undefined' ? QA_TEXT_R8_08 : {}
);
