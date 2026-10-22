// 검산 (중간과제 v1.0 · katej5). 약속은 js/README.md
// 같은 결과를 다른 길로 다시 세어 서로 맞는지 본다 — 집계 실수·줄 누락·근거 누락을 화면에서 바로 알리기 위한 자기 점검.
// 같은 코드의 결과끼리 맞춰 보는 것이라 독립 검산은 아니고, 분류가 '옳은지'는 알려 주지 않는다(그건 data/검증의 기대 라벨 대조로 확인).
window.ATM = window.ATM || {};

(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }

  // parsed(parseCSV 결과), items(classify 결과), topics(주제 이름 배열), stats(app.js 요약) → [{ label, ok, detail }]
  ATM.selfCheck = function (parsed, items, topics, stats) {
    var out = [];
    function add(label, ok, detail) { out.push({ label: label, ok: !!ok, detail: detail }); }

    // 1. 줄 누락: 읽은 데이터 줄은 모두 '유효' 아니면 '건너뜀' 중 하나여야 한다
    var n = items.length, skip = parsed.skipped.length;
    add("읽은 줄이 빠지지 않음", parsed.records == null || n + skip === parsed.records,
      "유효 " + n + " + 건너뛴 줄 " + skip + " = CSV 데이터 줄 " + (parsed.records == null ? "?" : parsed.records));

    // 2. 분류됨 + 미분류 = 유효 기사 수 (요약 숫자를 기사 목록에서 다시 셈)
    var classified = items.filter(function (it) { return it.topics.length > 0; }).length;
    add("분류됨 + 미분류 = 총 건수", classified === stats.classified && n - classified === stats.unclassified && stats.total === n,
      "분류됨 " + stats.classified + " + 미분류 " + stats.unclassified + " = " + stats.total + " (기사 목록에서 다시 셈: " + classified + " + " + (n - classified) + ")");

    // 3. 주제별 막대 합계 = 기사마다 붙은 주제 수의 합 (다중 분류 때문에 총 건수보다 클 수 있음)
    var byTopic = sum(topics.map(function (t) { return items.filter(function (it) { return it.topics.indexOf(t) >= 0; }).length; }));
    var perItem = sum(items.map(function (it) { return it.topics.length; }));
    var multi = items.filter(function (it) { return it.topics.length > 1; }).length;
    add("주제별 합계 = 기사별 주제 수의 합", byTopic === perItem,
      "막대 합계 " + byTopic + " = 기사별 합 " + perItem + " · 다중 분류 기사 " + multi + "건이 " + (perItem - classified) + "번 더 셈");

    // 4. 분류율 + 미분류율 = 100% (분모 = 유효 기사 수)
    add("비율의 분모 = 유효 기사 수", n === 0 || Math.abs(stats.classified / n + stats.unclassified / n - 1) < 1e-9,
      n ? "분류율 " + (stats.classified / n * 100).toFixed(1) + "% + 미분류율 " + (stats.unclassified / n * 100).toFixed(1) + "% = 100% (분모 " + n + ")" : "기사 없음");

    // 5. 분류 근거: 주제가 붙은 기사는 모두 그 주제의 근거 낱말이 있어야 한다
    var noWhy = items.filter(function (it) {
      var keys = Object.keys(it.why || {});
      return keys.join("|") !== it.topics.join("|") ||
        keys.some(function (k) { return !it.why[k].length || it.why[k].some(function (w) { return !w.words || !w.words.length; }); });
    });
    add("분류된 기사마다 근거 낱말이 있음", noWhy.length === 0,
      noWhy.length ? "근거가 빠진 줄: " + noWhy.map(function (it) { return it.line; }).join(", ") : "주제가 붙은 " + classified + "건 모두 근거 있음");

    // 6. 점수: 숫자가 아닌 점수가 없어야 한다 (날짜 형식이 깨지면 전체 점수가 NaN이 되던 문제 · #21 리뷰)
    var bad = items.filter(function (it) { return typeof it.score !== "number" || !isFinite(it.score); });
    add("읽기 우선순위 점수가 모두 숫자", bad.length === 0,
      bad.length ? "숫자가 아닌 줄: " + bad.map(function (it) { return it.line; }).join(", ") : n + "건 모두 숫자");

    return out;
  };

  // el, checks → 요약 아래 검산 상자 (통과 수 · 항목마다 ✓/✗와 세는 방법)
  ATM.renderSelfCheck = function (el, checks) {
    if (!el) return;
    var pass = checks.filter(function (c) { return c.ok; }).length;
    el.innerHTML = '<details' + (pass === checks.length ? "" : " open") + '><summary class="' + (pass === checks.length ? "check-ok" : "check-bad") + '">검산 ' +
      pass + "/" + checks.length + (pass === checks.length ? " 통과" : " — 확인 필요") + "</summary>" +
      '<ul class="checks">' + checks.map(function (c) {
        return '<li class="' + (c.ok ? "check-ok" : "check-bad") + '"><span aria-hidden="true">' + (c.ok ? "✓" : "✗") + "</span> " +
          '<span class="sr-only">' + (c.ok ? "통과" : "실패") + "</span>" + esc(c.label) + ' <span class="why">' + esc(c.detail) + "</span></li>";
      }).join("") + "</ul>" +
      '<p class="hint">같은 결과를 다른 길로 다시 세어 맞춰 보는 자기 점검입니다. 계산 실수·줄 누락·근거 누락을 잡지만, 분류가 옳은지는 알려 주지 않습니다(그건 <code>data/검증/</code>의 기대 라벨 대조로 확인).</p></details>';
  };
})();
