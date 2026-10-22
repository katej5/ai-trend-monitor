# js 함수 약속 (W1 · #4)

1차(W6 · W7)에서 A와 B가 이 약속을 따라 각자 파일을 채운다. 바꾸고 싶으면 PR로 이 문서부터 고친다.

- `index.html`을 더블클릭해서 열어도 돌아가야 하므로 ES 모듈(`import`/`export`)은 쓰지 않는다. 각 파일은 전역 이름공간 `window.ATM`에 함수를 붙인다.
- 불러오는 순서: `rules.js` → `data/example.js` → A(`import` · `classify` · `keywords`) → B(`charts` · `grid` · `export`) → (v1.0) `check` → `app.js`
- 지금 각 파일에는 빈 결과를 돌려주는 자리 함수만 있다. 이름과 입력·출력 모양은 그대로 두고 속을 채운다.

## 공통 입력

| 이름 | 파일 | 모양 |
|---|---|---|
| `window.RULES` | `rules.js` (#5) | 아래 「RULES 모양」 |
| `window.EXAMPLE_CSV` | `data/example.js` (#6) | `data/example.csv`와 같은 내용을 담은 문자열 |

## A · 데이터 처리

| 함수 | 파일 | 입력 | 출력 |
|---|---|---|---|
| `ATM.parseCSV(text)` | `js/import.js` | CSV 문자열 | `{ rows: [{ line, date, title, url, source }], skipped: [{ line, reason }], records }`<br>(v1.0) `records` = 머리글을 뺀 데이터 레코드 수(검산용)<br>`line`은 원본 줄 번호(머리글 = 1). 빈 줄 · 날짜 없는 줄 · 날짜 형식 오류(`YYYY-MM-DD`가 아니거나 없는 날짜) 줄은 `skipped`로 |
| `ATM.classify(rows, rules)` | `js/classify.js` | `parseCSV`의 `rows` · `RULES` | `items` 배열(입력 순서 그대로). 한 건 = 기획안의 「A → B로 넘길 결과 한 건」<br>`{ date, title, url, source, grade, gradeReason, topics, keywords, score }`<br>+ W6에서 더한 칸: `line`(CSV 줄 번호) · `gradeType`(출처 유형) · `oa`(원문 무료 여부, 미등록이면 `null`) · `unregistered`(등급표에 없는 도메인이면 `true`) · `similar`(비슷한 기사의 줄 번호 배열)<br>+ v1.0(중간과제): `why` = 주제 이름 → 걸린 근거 `[{ rule, words }]` (`rule`은 `"낱말"` 또는 복합 조건 이름, `words`는 실제로 걸린 낱말). `topics`는 `Object.keys(why)`와 같다<br>`score`는 반올림 전 값 → 화면에서 소수 둘째 자리로 표시<br>어느 주제에도 안 걸리면 `topics: []` |
| `ATM.byImportance(a, b)` | `js/classify.js` | `items`의 두 건 | 중요도 순위 비교 함수: 점수 → 날짜 최신 → 등급 → 줄 번호 (rules.js 동점 규칙). `items.slice().sort(ATM.byImportance)`로 씀. 그리드(W9)는 이걸로 정렬 |
| `ATM.normalize(s)` | `js/classify.js` | 문자열 | 소문자 + 특수 하이픈을 `-`로. 분류·키워드가 같이 씀 |
| `ATM.extractKeywords(title, rules)` | `js/keywords.js` | 제목 · `RULES` | `["EU AI Act", "표시 의무"]` 같은 키워드 배열 (한 기사 안에서 중복 없음). `classify`가 불러 씀 · W6에서 먼저 구현 |
| `ATM.keywordRanks(items, baseDate[, rules])` | `js/keywords.js` | `items` · 기준일 `"YYYY-MM-DD"` · (선택) `RULES` — 안 넘기면 전역 `RULES` | `{ "90d": {...}, "30d": {...}, "7d": {...}, "1d": {...} }`<br>각 값 = `{ window: "7d", label: "7일", days: 7, rank: [{ keyword, count, prev }] }` 상위 `rules.keywords.topN`(10)개<br>`count` = 그 기간에 키워드가 들어간 기사 수, `prev` = 바로 앞 같은 길이 기간의 기사 수. 순위는 건수 → 직전 건수 → 글자 코드 순서<br>+ v1.0: `prevDaysCovered` = 직전 기간 안에 자료가 실제로 있는 날 수(자료가 늦게 시작하면 `days`보다 작음 → 표에 '자료 부족' 표시). `1d`의 라벨은 '기준일'(기준일 하루) |

기준일(`baseDate`)은 `app.js`가 `items`의 가장 늦은 날짜로 정해서 넘긴다.

## B · 화면

| 함수 | 파일 | 입력 | 하는 일 |
|---|---|---|---|
| `ATM.renderSummary(stats)` | `js/charts.js` | `{ total, classified, unclassified, skipped: [{ line, reason }] }` + v1.0 `firstDate` · `baseDate` · `rulesVersion` | `#stat-total` 등 숫자 4칸, `#summary-meta`(분류율·미분류율과 분모, 자료 날짜, 기준 버전), `#skipped-lines`(건너뛴 줄 번호) 채우기 |
| `ATM.renderTopicCounts(el, items, topics, onSelect)` | `js/charts.js` | `#topic-counts .slot` · `items` · 주제 이름 배열 · 막대를 눌렀을 때 부를 함수 `onSelect(topic)` | 가로 막대 5개 + 미분류 |
| `ATM.renderTrend(el, items, topics, selected, baseDate)` | `js/charts.js` | `#weekly-trend .slot` · … · 선택된 주제 배열 | 주별 입력 건수 꺾은선. v1.0: 자료가 3주 미만이면 그리지 않고 안내만 |
| `ATM.renderGrid(el, items, topics)` | `js/grid.js` | `#importance-grid .slot` | 주제 카드 5장, 카드마다 `score` 상위 5건(v1.0 이름: 규칙 기반 읽기 우선순위) + 기사마다 분류 근거(`why`) |
| `ATM.renderKeywordTable(el, rank)` | `js/grid.js` | `#keyword-table` · `keywordRanks(...)["7d"]` 같은 값 하나 | 키워드 · 건수 · 증감 표. 탭 전환은 `app.js`가 함 |
| `ATM.renderUnclassified(el, items)` | `js/grid.js` | `#unclassified .slot` · `topics`가 빈 `items` | 미분류 목록 |
| `ATM.renderEvidence(el, items, topics, filter)` | `js/grid.js` | `#evidence-list` · `items` · 주제 이름 배열 · `"all"` \| `"unclassified"` \| 주제 이름 | (v1.0) 기사별 표: 줄 · 제목 · 붙은 주제마다 실제로 걸린 낱말(`why`). 보인 건수를 돌려줌 |
| `ATM.toCSV(items)` | `js/export.js` | `items` | CSV 문자열. 다시 넣으면 같은 결과가 나와야 함(완료 기준 5). v1.0: 맨 뒤 `evidence` 칸(주제별 분류 근거) 추가 |
| `ATM.toMarkdown(items, ranks, stats)` | `js/export.js` | … | 마크다운 문자열. (v1.0) `stats.checks`가 있으면 '검산' 절을 넣음 |
| `ATM.selfCheck(parsed, items, topics, stats)` | `js/check.js` | `parseCSV` 결과 · `items` · 주제 이름 배열 · 요약 `stats` | (v1.0) `[{ label, ok, detail }]` 6개: 줄 누락 없음 · 분류됨+미분류=총 건수 · 주제별 합계=기사별 주제 수의 합 · 비율 분모 · 분류된 기사마다 근거 · 점수가 모두 숫자. 같은 결과를 다른 길로 다시 센 자기 점검(독립 검산 아님) |
| `ATM.renderSelfCheck(el, checks)` | `js/check.js` | `#self-check` · `selfCheck` 결과 | (v1.0) 요약 아래 '검산 n/6 통과' 상자. 실패가 있으면 펼쳐서 보여 줌 |

파일 저장(다운로드)과 버튼 연결은 `app.js`가 한다.

## RULES 모양 (#5에서 확정)

전체 값과 적용 방식(낱말 일치 · 등급 고르는 순서 · 중요도 식 · 키워드 추출 순서)은 `rules.js` 맨 위 주석에 있다. 아래는 모양만.

```js
window.RULES = {
  version: "0.2 …",
  topics: {                       // 주제 이름 → 키워드. 적힌 순서 = 화면 순서
    "AI 에이전트": {
      en: ["ai agent", "agentic", "mcp"],      // 낱말 단위로 일치
      ko: ["에이전트", "에이전틱"],            // 제목에 들어 있으면 일치
      exclude: ["travel agent"],               // 걸리면 이 주제는 안 붙임
      combos: [                                // (v1.0 · 선택) 복합 조건: all의 묶음마다 하나 이상 걸려야 일치
        { name: "AI × 공공·정부", all: [{ en: ["ai"], ko: ["인공지능"] }, { ko: ["정부", "예산"] }] }
      ]
    },
    // … 5개
  },
  gradeWeight: { A: 3, B: 2, C: 1, D: 0.5 },
  unknownGrade: "C",              // 등급표에 없는 도메인
  sources: [                      // 출처 등급표 (기획안 「출처 등급과 근거」)
    { domain: "arxiv.org", type: "프리프린트", grade: "B", oa: true, reason: "심사 전 논문 · 원문 무료" },
    { domain: "huggingface.co", pathPrefix: "/papers", type: "프리프린트", grade: "B", oa: true, reason: "…" }
  ],
  score: { overlap: 2, recencyHalfLifeDays: 14, topN: 5 },   // 〔사람이 정할 것〕
  keywords: {
    windows: [{ id: "90d", label: "90일", days: 90 }, /* 30d · 7d · 1d */],
    topN: 10, minKo: 2, minEn: 3,
    phrases: ["EU AI Act", "AI 기본법"],
    particles: ["으로", "에서", "은", "는"],
    stopwords: { en: ["the", "ai"], ko: ["인공지능", "발표"] }
  }
};
```

- `score.recencyHalfLifeDays`: 기준일에서 이 일수만큼 지나면 최신성이 절반 (`0.5 ^ (경과일 ÷ 값)`)
- `sources`는 도메인이 가장 긴 줄, 그다음 `pathPrefix`가 있는 줄이 이긴다

`app.js`는 주제 순서를 `Object.keys(RULES.topics)`로 읽는다.
