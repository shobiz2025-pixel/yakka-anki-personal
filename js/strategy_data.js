/**
 * 薬価算定戦略ツール データ定義
 *
 * 構造:
 *   checklist     - 事前チェック項目（対象医薬品の特性を同定）
 *   pricing_tree  - 算定方式の決定木
 *   components    - 固定/変動コンポーネント一覧
 *   strategies    - 戦略推奨事項
 *   qa_map        - Q&A問番号 → data.js item id のマッピング
 */

const STRATEGY_DATA = {

  /* ========================================
   * 事前チェックシート
   * ======================================== */
  checklist: {
    // ── Phase 1: 基本分類 ──
    basic: {
      label: "基本分類",
      items: [
        {
          id: "listing_status",
          question: "対象医薬品の収載状況",
          type: "select",
          required: true,
          options: [
            { value: "unlisted", label: "未収載（これから薬価算定）" },
            { value: "listed", label: "既収載（薬価改定・維持戦略）" }
          ],
          help: "この選択により、以降のチェック項目と戦略が切り替わります。",
          qa_refs: []
        },
        {
          id: "drug_category",
          question: "医薬品の種別",
          type: "select",
          required: true,
          options: [
            { value: "new_drug", label: "新薬（再審査期間あり）" },
            { value: "generic", label: "新規後発品" },
            { value: "biosimilar", label: "バイオ後続品" },
            { value: "ag", label: "オーソライズド・ジェネリック（AG）" }
          ],
          help: "定義9「新薬」：再審査を受けなければならないとされた新規収載品",
          qa_refs: ["15", "16", "17", "18", "19"],
          data_ids: [9, 10]
        },
        {
          id: "formulation_type",
          question: "投与形態",
          type: "select",
          required: true,
          options: [
            { value: "oral", label: "内用" },
            { value: "injection", label: "注射" },
            { value: "external", label: "外用" }
          ],
          help: "定義4「投与形態」：内用、注射又は外用",
          qa_refs: [],
          data_ids: [4]
        }
      ]
    },

    // ── Phase 2: 未収載品向けチェック ──
    unlisted: {
      label: "新規収載品の特性確認",
      condition: { listing_status: "unlisted" },
      items: [
        {
          id: "has_similar",
          question: "類似薬の有無",
          type: "select",
          required: true,
          options: [
            { value: "yes", label: "あり（類似薬効比較方式）" },
            { value: "no", label: "なし（原価計算方式）" }
          ],
          help: "定義15「類似薬」：(イ)効能・効果 (ロ)薬理作用 (ハ)組成・化学構造 (ニ)投与形態等から総合判断",
          qa_refs: ["30", "31", "32", "33", "34", "35", "36"],
          data_ids: [15]
        },
        {
          id: "similar_method",
          question: "類似薬効比較方式の種別",
          type: "select",
          condition: { has_similar: "yes" },
          options: [
            { value: "method1", label: "類似薬効比較方式（Ⅰ）" },
            { value: "method2", label: "類似薬効比較方式（Ⅱ）" }
          ],
          help: "（Ⅱ）は過去6年以内に薬価収載された類似薬の1日薬価平均から算定",
          qa_refs: ["45", "46", "47", "48", "49"],
          data_ids: [20, 21]
        },
        {
          id: "is_combination",
          question: "配合剤か",
          type: "select",
          options: [
            { value: "no", label: "単剤" },
            { value: "new_combination", label: "新医療用配合剤" },
            { value: "similar_combination", label: "類似処方医療用配合剤" }
          ],
          help: "配合剤は単剤薬価の合算を基本とした特例算定",
          qa_refs: ["92", "93"],
          data_ids: [52, 53, 54]
        },
        {
          id: "is_kit",
          question: "キット製品か",
          type: "yesno",
          help: "キット製品はデバイス部分＋薬剤部分の合算",
          qa_refs: ["85", "86", "87", "88", "89", "90", "91"],
          data_ids: [48]
        },
        {
          id: "has_racemate",
          question: "ラセミ体又は先行品が存在するか",
          type: "yesno",
          condition: { drug_category: "new_drug" },
          help: "先行品の薬価をベースに算定する特例あり",
          qa_refs: [],
          data_ids: [113, 56, 57]
        },
        {
          id: "has_foreign_price",
          question: "外国（米英独仏）での販売実績があるか",
          type: "select",
          options: [
            { value: "yes_multiple", label: "複数国で販売あり" },
            { value: "yes_one", label: "1ヶ国のみ販売あり" },
            { value: "no", label: "なし" }
          ],
          help: "外国平均価格調整：算定薬価が外国平均価格の0.75倍〜1.5倍の範囲に収まるよう調整",
          qa_refs: ["63", "64", "65", "66", "67", "68", "69", "70", "71", "72", "73", "74", "75", "76", "77"],
          data_ids: [33, 34]
        }
      ]
    },

    // ── Phase 3: 補正加算チェック（未収載品向け） ──
    premiums: {
      label: "補正加算の該当性",
      condition: { listing_status: "unlisted", drug_category: "new_drug" },
      items: [
        {
          id: "premium_innovation",
          question: "画期性加算（70-120%）の3要件を全て満たすか",
          type: "yesno",
          help: "①臨床上有用な新規作用機序 ②類似薬に比して高い有効性又は安全性 ③治療方法の改善",
          qa_refs: ["55", "56"],
          data_ids: [24]
        },
        {
          id: "premium_usefulness1",
          question: "有用性加算（Ⅰ）（35-60%）の要件を2つ以上満たすか",
          type: "yesno",
          help: "画期性加算の3要件のうち2つ以上",
          qa_refs: ["57", "57-2", "57-3", "58"],
          data_ids: [25]
        },
        {
          id: "premium_usefulness2",
          question: "有用性加算（Ⅱ）（5-30%）の要件を1つ満たすか",
          type: "yesno",
          help: "画期性加算の3要件のうち1つ、又は臨床上の位置づけが客観的に示されている",
          qa_refs: ["59"],
          data_ids: [26]
        },
        {
          id: "premium_orphan",
          question: "希少疾病用医薬品の指定を受けているか",
          type: "yesno",
          help: "市場性加算（Ⅰ）10-20%の対象",
          qa_refs: [],
          data_ids: [27]
        },
        {
          id: "premium_market2",
          question: "市場規模が著しく小さいか",
          type: "yesno",
          help: "市場性加算（Ⅱ）5%の対象",
          qa_refs: [],
          data_ids: [28]
        },
        {
          id: "premium_pediatric",
          question: "小児に係る効能・用法を有するか",
          type: "yesno",
          help: "小児加算（5-20%）の対象",
          qa_refs: [],
          data_ids: [30]
        },
        {
          id: "premium_pioneer",
          question: "先駆的医薬品の指定を受けているか",
          type: "yesno",
          help: "先駆加算（5-20%）の対象",
          qa_refs: [],
          data_ids: [31]
        },
        {
          id: "premium_rapid",
          question: "迅速導入加算の対象となるか（ドラッグ・ラグ解消）",
          type: "yesno",
          help: "日本での開発着手タイミングが評価される",
          qa_refs: ["62", "62-3", "62-4"],
          data_ids: [32]
        },
        {
          id: "premium_specific",
          question: "特定用途加算の対象となるか（AMR等）",
          type: "yesno",
          help: "特定用途加算（5-20%）",
          qa_refs: [],
          data_ids: [29]
        }
      ]
    },

    // ── Phase 4: 既収載品向けチェック ──
    listed: {
      label: "既収載品の現況確認",
      condition: { listing_status: "listed" },
      items: [
        {
          id: "has_generic",
          question: "後発品の収載状況",
          type: "select",
          options: [
            { value: "none", label: "後発品なし" },
            { value: "exists_under80", label: "後発品あり（置換率80%未満）" },
            { value: "exists_over80", label: "後発品あり（置換率80%以上）" }
          ],
          help: "G1品目（80%以上）/G2品目（80%未満）の判定に関わる",
          qa_refs: ["97", "98", "98-2", "98-3", "98-4", "99", "100", "101", "102", "102-2", "102-3", "102-4", "102-5", "102-6", "102-7"],
          data_ids: []
        },
        {
          id: "generic_years",
          question: "最初の後発品収載からの経過年数",
          type: "select",
          condition: { has_generic: ["exists_under80", "exists_over80"] },
          options: [
            { value: "under10", label: "10年未満" },
            { value: "10to12", label: "10年以上12年未満" },
            { value: "over12", label: "12年以上" }
          ],
          help: "後発品収載後10年経過でG1/G2ルール適用",
          qa_refs: ["102", "102-2", "102-3"],
          data_ids: []
        },
        {
          id: "npc_eligible",
          question: "新薬創出・適応外薬解消等促進加算の対象か",
          type: "yesno",
          help: "薬価維持の最重要ツール。対象品目の要件（ロ①〜⑩）を確認",
          qa_refs: ["127", "127-2", "127-3", "127-4", "127-5", "127-6", "127-7"],
          data_ids: [84, 85, 86]
        },
        {
          id: "npc_cumulative",
          question: "新薬創出等加算の累積額があるか",
          type: "yesno",
          condition: { npc_eligible: "yes" },
          help: "累積額は将来的に控除される（問127-8〜10）",
          qa_refs: ["127-8", "127-9", "127-10"],
          data_ids: []
        },
        {
          id: "sales_expansion_risk",
          question: "市場拡大再算定のリスクがあるか",
          type: "select",
          options: [
            { value: "low", label: "低リスク（予測販売額の2倍未満）" },
            { value: "medium", label: "中リスク（予測の2倍近い）" },
            { value: "high", label: "高リスク（予測の2倍超・150億超）" }
          ],
          help: "基準年間販売額の設定が最大のレバー",
          qa_refs: ["103", "104", "105", "106", "107", "108", "109", "110"],
          data_ids: [65, 66]
        },
        {
          id: "efficacy_addition_plan",
          question: "効能追加の予定があるか",
          type: "select",
          options: [
            { value: "none", label: "なし" },
            { value: "orphan", label: "希少疾病の効能追加" },
            { value: "pediatric", label: "小児適応の追加" },
            { value: "other", label: "その他の効能追加" }
          ],
          help: "効能追加は薬価上昇の機会だが、効能変化再算定のリスクも伴う",
          qa_refs: ["116", "116-2", "116-3", "116-4", "130", "131"],
          data_ids: [67, 68, 89, 90]
        },
        {
          id: "true_endpoint_data",
          question: "市販後にtrue endpointデータを取得済みか",
          type: "yesno",
          help: "既収載品の薬価改定時の加算（問132）の対象となり得る",
          qa_refs: ["132"],
          data_ids: []
        },
        {
          id: "unprofitable",
          question: "不採算品に該当する可能性があるか",
          type: "yesno",
          help: "不採算品再算定による薬価引上げの可能性",
          qa_refs: ["124", "125", "126"],
          data_ids: [82]
        }
      ]
    }
  },

  /* ========================================
   * 算定方式の決定木
   * ======================================== */
  pricing_tree: {
    // 未収載品の算定フロー
    unlisted: [
      {
        id: "step1",
        title: "STEP 1：医薬品種別の確認",
        description: "新薬 / 新規後発品 / バイオ後続品 / 配合剤 / キット製品",
        branch_key: "drug_category",
        branches: {
          new_drug: "step2_new",
          generic: "step_generic",
          biosimilar: "step_biosimilar",
          ag: "step_ag"
        },
        qa_refs: ["15", "16", "17", "18", "19"],
        data_ids: [9, 10]
      },
      {
        id: "step2_new",
        title: "STEP 2：類似薬の有無",
        description: "定義15の(イ)〜(ニ)の4軸で類似性を総合判断",
        branch_key: "has_similar",
        branches: {
          yes: "step3_similar",
          no: "step3_cost"
        },
        strategic_note: "【戦略ポイント】比較薬の選定は薬価算定上最大の変動要因。どの既収載品を類似薬として主張するかで基本薬価が大きく変わる。",
        qa_refs: ["30", "31", "32", "33", "34", "35", "36", "37", "38"],
        data_ids: [15, 16, 17, 18]
      },
      {
        id: "step3_similar",
        title: "STEP 3A：類似薬効比較方式",
        description: "比較薬の一日薬価を基準に算定。剤形間比・規格間調整を適用。",
        sub_steps: [
          "最類似薬（汎用規格）の選定",
          "一日薬価合わせ",
          "剤形間比の適用（必要な場合）",
          "規格間調整（非汎用規格の場合）",
          "補正加算の適用",
          "外国平均価格調整"
        ],
        strategic_note: "【戦略ポイント】比較薬の薬価が高いほど有利。同一薬効群で最も薬価の高い既収載品を類似薬として主張できるかが鍵。",
        qa_refs: ["37", "38", "38-2", "42", "43", "44", "45", "46", "47", "48", "78", "78-2", "78-3", "78-4", "78-5", "78-6"],
        data_ids: [16, 19, 20, 21, 35]
      },
      {
        id: "step3_cost",
        title: "STEP 3B：原価計算方式",
        description: "製造原価＋営業利益＋流通経費＋消費税の積上げ",
        sub_steps: [
          "原材料費の算定",
          "製造経費（労務費、製造経費）",
          "一般管理販売費（研究開発費含む）",
          "営業利益（平均的利益率±補正）",
          "流通経費",
          "消費税",
          "補正加算の適用",
          "外国平均価格調整"
        ],
        strategic_note: "【戦略ポイント】各費目の積上げに交渉余地あり。特に研究開発費・営業利益率の補正は加算の取得状況に連動。輸出価格は4ヶ国最低価格が原則（問53-14,15）。",
        qa_refs: ["50", "51", "52", "53", "53-2", "53-3", "53-4", "53-5", "53-6", "53-7", "53-8", "53-9", "53-10", "53-11", "53-12", "53-13", "53-14", "53-15"],
        data_ids: [22, 42]
      },
      {
        id: "step_generic",
        title: "新規後発品の算定",
        description: "先発品の薬価に0.5（10品目以上は0.4）を乗じた額",
        sub_steps: [
          "最類似薬（同一成分の汎用規格先発品）の選定",
          "先発品薬価 × 0.5（又は0.4）",
          "規格間調整（非汎用規格の場合）",
          "最低薬価の確認"
        ],
        qa_refs: ["79", "80", "81", "82", "83", "84"],
        data_ids: [43, 44, 45, 46, 47]
      },
      {
        id: "step_biosimilar",
        title: "バイオ後続品の算定",
        description: "先行バイオ医薬品の薬価に0.7を乗じた額",
        sub_steps: [
          "先行バイオ医薬品の特定",
          "先行品薬価 × 0.7",
          "規格間調整",
          "最低薬価の確認"
        ],
        qa_refs: [],
        data_ids: [47]
      },
      {
        id: "step_ag",
        title: "オーソライズド・ジェネリック（AG）の算定",
        description: "先発品と同一の後発品として算定",
        sub_steps: [
          "先発品の特定",
          "先発品薬価 × 0.5（又は0.4）",
          "AG固有の算定ルール確認"
        ],
        qa_refs: [],
        data_ids: [47]
      }
    ],

    // 既収載品の改定フロー
    listed: [
      {
        id: "listed_step1",
        title: "STEP 1：通常改定の適用",
        description: "市場実勢価格加重平均値調整幅方式による改定",
        details: "実勢価格（薬価調査結果）に基づく機械的引下げ。避けられない。",
        strategic_note: "【戦略ポイント】流通管理（卸への値引き抑制）が唯一のレバー。乖離率を小さく抑えることが重要。",
        qa_refs: ["94", "95"],
        data_ids: [36]
      },
      {
        id: "listed_step2",
        title: "STEP 2：新薬創出等加算の適用確認",
        description: "対象品目の要件を満たすか確認し、加算により薬価維持を図る",
        details: "要件ロの①〜⑩のいずれかを満たす新薬で、後発品未収載のもの",
        strategic_note: "【戦略ポイント】薬価維持の最重要ツール。企業レベルの評価指標（A-1国内試験数、A-2収載実績、A-3革新性）も影響。",
        qa_refs: ["127", "127-2", "127-3", "127-4", "127-5", "127-6", "127-7", "127-8", "127-9", "127-10", "127-11", "127-12", "127-13", "127-14", "127-15", "127-16", "127-17", "127-18", "127-19", "127-20"],
        data_ids: [84, 85, 86]
      },
      {
        id: "listed_step3",
        title: "STEP 3：再算定リスクの評価",
        description: "市場拡大再算定・効能変化再算定・用法用量変化再算定の該当性",
        sub_steps: [
          "基準年間販売額 vs 実績販売額の比較",
          "効能追加による主たる効能の変化有無",
          "用法用量の大幅変更の有無",
          "NDBによる四半期モニタリング状況"
        ],
        strategic_note: "【戦略ポイント】基準年間販売額の設定が最大のレバー。効能追加戦略と再算定リスクはトレードオフ。",
        qa_refs: ["103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "114", "115", "116", "116-2", "116-3", "116-4", "117", "118", "118-2", "118-3"],
        data_ids: [65, 66, 67, 68, 69, 70, 71, 72]
      },
      {
        id: "listed_step4",
        title: "STEP 4：長期収載品ルールの確認",
        description: "後発品収載後のG1/G2品目への該当性と段階的引下げ",
        sub_steps: [
          "後発品収載後10年経過の確認",
          "後発品置換え率80%以上 → G1品目",
          "後発品置換え率80%未満 → G2品目",
          "後発品価格への段階的引下げスケジュール確認",
          "撤退スキームの検討"
        ],
        strategic_note: "【戦略ポイント】後発品参入後の薬価下落は構造的に不可避。AG戦略・撤退判断のタイミングが重要。",
        qa_refs: ["97", "98", "98-2", "98-3", "98-4", "99", "100", "101", "102", "102-2", "102-3", "102-4", "102-5", "102-6", "102-7"],
        data_ids: []
      },
      {
        id: "listed_step5",
        title: "STEP 5：薬価改定時の加算の可能性",
        description: "効能追加・市販後データに基づく薬価上昇の機会",
        sub_steps: [
          "希少疾病の効能追加（問130）",
          "小児適応の追加（問131）",
          "true endpointデータによる臨床的有用性検証（問132）"
        ],
        strategic_note: "【戦略ポイント】収載後に薬価を上げられる数少ない手段。市販後大規模臨床試験への投資が薬価上のリターンにつながる。",
        qa_refs: ["128", "129", "130", "131", "132"],
        data_ids: [89, 90]
      },
      {
        id: "listed_step6",
        title: "STEP 6：外国平均価格調整（下限フロア）",
        description: "改定時も外国平均価格の0.75倍が下限として機能",
        strategic_note: "【戦略ポイント】海外価格が高い製品は日本での薬価下落にブレーキ。為替が円安に振れると有利。",
        qa_refs: ["133"],
        data_ids: []
      }
    ]
  },

  /* ========================================
   * 固定/変動コンポーネント
   * ======================================== */
  components: {
    unlisted: {
      fixed: [
        { label: "組成・剤形・投与形態", description: "承認申請時に確定", data_ids: [4, 5] },
        { label: "一日薬価の算出", description: "承認された用法用量から機械的に算出", data_ids: [2, 3], qa_refs: ["4", "5", "6", "7", "8", "9", "10", "11", "13", "14"] },
        { label: "新薬/後発品の区分", description: "再審査付与の有無で確定", data_ids: [9, 10] },
        { label: "汎用規格の判定", description: "年間販売量で機械的に決定", data_ids: [14], qa_refs: ["27", "28", "29"] },
        { label: "規格間調整", description: "数式により機械的に算出", data_ids: [35], qa_refs: ["78", "78-2", "78-3", "78-4", "78-5", "78-6"] },
        { label: "外国平均価格の上下限", description: "0.75倍〜1.5倍の範囲（機械的）", data_ids: [34], qa_refs: ["65", "66", "67", "68", "69", "70", "71", "72", "73", "74", "75", "76", "77"] },
        { label: "後発品の算定率", description: "先発品の0.5掛け（10品目以上0.4掛け）", data_ids: [47] }
      ],
      variable: [
        { label: "比較薬の選定", description: "最大の変動要因。(イ)〜(ニ)の総合判断に幅あり", data_ids: [15, 16, 17, 18], qa_refs: ["30", "31", "32", "33", "34", "35", "36", "37", "38", "38-2", "39", "40", "41"], importance: "critical" },
        { label: "算定方式の選択", description: "類似薬の有無による方式決定", data_ids: [20, 21, 22], importance: "critical" },
        { label: "補正加算の獲得", description: "画期性70-120%〜小児5-20%。開発戦略で設計", data_ids: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32], qa_refs: ["55", "56", "57", "57-2", "57-3", "58", "59", "62", "62-3", "62-4"], importance: "high" },
        { label: "原価計算の費目構成", description: "各費目の積上げに交渉余地", data_ids: [22, 42], qa_refs: ["50", "51", "52", "53", "53-2", "53-3", "53-4", "53-5", "53-6", "53-7", "53-8", "53-9", "53-10", "53-11", "53-12", "53-13", "53-14", "53-15"], importance: "high" },
        { label: "外国平均価格調整", description: "為替レート・各国薬価による変動", data_ids: [33, 34], qa_refs: ["63", "64"], importance: "medium" },
        { label: "用法用量の設計", description: "開発段階で比較薬の一日薬価を意識", data_ids: [2, 3], importance: "high" }
      ]
    },
    listed: {
      fixed: [
        { label: "市場実勢価格による引下げ", description: "乖離率に基づく機械的引下げ（毎改定）", data_ids: [36], qa_refs: ["94", "95"] },
        { label: "長期収載品の引下げ", description: "G1/G2ルールによる段階的引下げ", data_ids: [], qa_refs: ["102", "102-2", "102-3", "102-4", "102-5", "102-6", "102-7"] },
        { label: "累積加算額の控除", description: "比較薬の新薬創出等加算累積額が将来控除", data_ids: [], qa_refs: ["96", "96-2", "96-3"] }
      ],
      variable: [
        { label: "新薬創出等加算", description: "薬価維持の最重要ツール", data_ids: [84, 85, 86], qa_refs: ["127", "127-2", "127-3", "127-4", "127-5", "127-6", "127-7", "127-8", "127-9", "127-10", "127-11"], importance: "critical" },
        { label: "流通管理", description: "卸への値引き抑制で乖離率を縮小", data_ids: [36], importance: "critical" },
        { label: "市場拡大再算定の回避", description: "基準年間販売額の設定が鍵", data_ids: [65, 66], qa_refs: ["103", "104", "105", "106", "107", "108", "109", "110"], importance: "high" },
        { label: "効能追加戦略", description: "薬価上昇の機会だが再算定リスクとトレードオフ", data_ids: [67, 68, 89, 90], qa_refs: ["116", "116-2", "116-3", "116-4", "130", "131"], importance: "high" },
        { label: "市販後エビデンス投資", description: "true endpointデータで薬価改定時の加算", data_ids: [], qa_refs: ["132"], importance: "medium" },
        { label: "外国平均価格の下限フロア", description: "0.75倍を下回らないよう調整", data_ids: [], qa_refs: ["133"], importance: "medium" },
        { label: "不採算品再算定", description: "原価割れの立証で薬価引上げ", data_ids: [82], qa_refs: ["124", "125", "126"], importance: "low" }
      ]
    }
  },

  /* ========================================
   * 戦略推奨事項
   * ======================================== */
  strategies: {
    unlisted: [
      {
        phase: "開発段階",
        items: [
          {
            title: "用法用量の設計",
            description: "比較薬の一日薬価を意識し、一日薬価合わせで有利になる用法用量を設計する",
            lever: "variable",
            importance: "high"
          },
          {
            title: "補正加算の要件設計",
            description: "画期性加算の3要件（新規作用機序、高い有効性/安全性、治療方法改善）を満たす臨床試験デザインを計画",
            lever: "variable",
            importance: "critical"
          },
          {
            title: "迅速導入加算への対応",
            description: "日本での開発着手タイミングを早めることで迅速導入加算の対象に",
            lever: "variable",
            importance: "medium"
          },
          {
            title: "グローバル価格戦略",
            description: "外国平均価格調整（0.75倍〜1.5倍）を見据えた海外薬価設定",
            lever: "variable",
            importance: "high"
          }
        ]
      },
      {
        phase: "算定時",
        items: [
          {
            title: "比較薬の選定戦略",
            description: "同一薬効群で最も薬価の高い既収載品を類似薬として主張。(イ)〜(ニ)の4軸の重み付けを意識",
            lever: "variable",
            importance: "critical"
          },
          {
            title: "補正加算の主張",
            description: "取得可能な全ての加算を根拠資料とともに主張。特に有用性加算(Ⅱ)は臨床的位置づけの主張で取得可能性あり",
            lever: "variable",
            importance: "critical"
          },
          {
            title: "原価計算の費目最適化",
            description: "類似薬なしの場合、各費目の積上げを最大化。研究開発費・営業利益率の補正は加算と連動",
            lever: "variable",
            importance: "high"
          },
          {
            title: "基準年間販売額の設定",
            description: "低すぎると将来の市場拡大再算定リスク上昇。適切な水準設定が重要",
            lever: "variable",
            importance: "high"
          }
        ]
      }
    ],
    listed: [
      {
        phase: "収載直後〜後発品参入前",
        items: [
          {
            title: "新薬創出等加算の対象維持",
            description: "要件ロ①〜⑩の維持。企業のパイプライン開発実績（A-1,A-2,A-3）も評価対象",
            lever: "variable",
            importance: "critical"
          },
          {
            title: "流通管理の徹底",
            description: "卸への値引きを抑制し、薬価調査における乖離率を最小化",
            lever: "variable",
            importance: "critical"
          },
          {
            title: "市場拡大再算定の回避",
            description: "販売額が基準年間販売額の2倍を超えないようモニタリング。NDB四半期監視に注意",
            lever: "variable",
            importance: "high"
          }
        ]
      },
      {
        phase: "効能追加時",
        items: [
          {
            title: "効能追加と再算定リスクのバランス",
            description: "新効能による売上拡大は効能変化再算定のトリガーになり得る。市場規模の変化を事前シミュレーション",
            lever: "variable",
            importance: "high"
          },
          {
            title: "既収載品の薬価改定時の加算",
            description: "希少疾病（問130）・小児適応（問131）の追加で加算取得の機会",
            lever: "variable",
            importance: "high"
          }
        ]
      },
      {
        phase: "後発品参入後",
        items: [
          {
            title: "AG戦略",
            description: "オーソライズド・ジェネリックによる後発品市場のコントロール",
            lever: "variable",
            importance: "high"
          },
          {
            title: "G1/G2区分の管理",
            description: "後発品置換え率80%のラインを意識した市場管理。G1→撤退スキーム（問102-7）",
            lever: "variable",
            importance: "medium"
          },
          {
            title: "撤退判断",
            description: "後発品収載後12年で一価格帯集約。収益性を見極めた撤退タイミングの判断",
            lever: "variable",
            importance: "medium"
          }
        ]
      },
      {
        phase: "長期的",
        items: [
          {
            title: "市販後エビデンス投資",
            description: "surrogate endpointで承認された品目は、true endpointデータで薬価改定時の加算を取得（問132）",
            lever: "variable",
            importance: "medium"
          },
          {
            title: "外国価格の維持",
            description: "海外での薬価を高水準に維持し、日本の外国平均価格調整の下限フロア（0.75倍）を活用",
            lever: "variable",
            importance: "medium"
          }
        ]
      }
    ]
  }
};
