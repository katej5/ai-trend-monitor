// 연결 (공동): 입력 → A → B. 약속은 js/README.md
(function () {
  var $ = function (sel) { return document.querySelector(sel); };
  var state = { items: [], ranks: null, stats: null, baseDate: null, selected: [], window: "90d" };

  function status(msg) { $("#input-status").textContent = msg; }

  function topics() {
    return window.RULES && RULES.topics ? Object.keys(RULES.topics) : [];
  }

  function run() {
    if (!window.RULES) { status("rules.js가 아직 없습니다 (#5)."); return; }
    var text = $("#csv-input").value;
    if (!text.trim()) { status("CSV를 붙여 넣거나 파일을 고르세요."); return; }

    var parsed = ATM.parseCSV(text);
    var items = ATM.classify(parsed.rows, RULES);
    var baseDate = items.reduce(function (max, it) { return it.date > max ? it.date : max; }, "");
    var unclassified = items.filter(function (it) { return !it.topics || it.topics.length === 0; });

    state.items = items;
    state.baseDate = baseDate;
    state.stats = {
      total: items.length,
      classified: items.length - unclassified.length,
      unclassified: unclassified.length,
      skipped: parsed.skipped,
      firstDate: items.reduce(function (min, it) { return !min || it.date < min ? it.date : min; }, ""),
      baseDate: baseDate,
      rulesVersion: RULES.version
    };
    state.ranks = ATM.keywordRanks(items, baseDate);

    ATM.renderSummary(state.stats);
    ATM.renderTopicCounts($("#topic-counts .slot"), items, topics(), onSelect);
    ATM.renderTrend($("#weekly-trend .slot"), items, topics(), state.selected, baseDate);
    ATM.renderGrid($("#importance-grid .slot"), items, topics());
    ATM.renderKeywordTable($("#keyword-table"), state.ranks[state.window]);
    ATM.renderUnclassified($("#unclassified .slot"), unclassified);
    renderEvidence();

    $("#export-csv").disabled = $("#export-md").disabled = items.length === 0;
    status(items.length ? "기준일 " + baseDate + " · " + items.length + "건" : "분류된 결과가 없습니다 (js 1차 구현 전).");
  }

  // (v1.0) 기사별 분류 근거: 보기(전체 · 미분류만 · 주제)를 바꾸면 다시 그림
  function renderEvidence() {
    var sel = $("#evidence-filter");
    if (sel.options.length === 2) topics().forEach(function (t) { sel.add(new Option(t + "만", t)); });
    var n = ATM.renderEvidence($("#evidence-list"), state.items, topics(), sel.value);
    $("#evidence-count").textContent = n + " / " + state.items.length + "건";
  }
  $("#evidence-filter").addEventListener("change", function () { if (state.items.length) renderEvidence(); });

  // 막대를 누르면 그 주제를 추이에 켜고 끈다
  function onSelect(topic) {
    var i = state.selected.indexOf(topic);
    if (i >= 0) state.selected.splice(i, 1); else state.selected.push(topic);
    ATM.renderTrend($("#weekly-trend .slot"), state.items, topics(), state.selected, state.baseDate);
  }

  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  $("#run").addEventListener("click", run);

  $("#load-example").addEventListener("click", function () {
    if (!window.EXAMPLE_CSV) { status("예시 입력이 아직 없습니다 (#6)."); return; }
    $("#csv-input").value = EXAMPLE_CSV;
    run();
  });

  $("#csv-file").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { $("#csv-input").value = reader.result; run(); };
    reader.readAsText(file, "utf-8");
  });

  document.querySelectorAll("#keyword-rank [role=tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll("#keyword-rank [role=tab]").forEach(function (t) {
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      state.window = tab.dataset.window;
      if (state.ranks) ATM.renderKeywordTable($("#keyword-table"), state.ranks[state.window]);
    });
  });

  $("#export-csv").addEventListener("click", function () {
    download("ai-trend-" + state.baseDate + ".csv", ATM.toCSV(state.items), "text/csv;charset=utf-8");
  });
  $("#export-md").addEventListener("click", function () {
    download("ai-trend-" + state.baseDate + ".md", ATM.toMarkdown(state.items, state.ranks, state.stats), "text/markdown;charset=utf-8");
  });

  // 열자마자 자동으로 불러오기 (입력 칸이 비어 있을 때만 · 붙여넣기·파일 선택은 그대로)
  // ① 배포 주소(http/https)에서는 저장소의 data/latest.csv를 먼저 읽는다 — 매일 수집(W12)이 이 파일을 갱신할 자리
  // ② 그 파일이 없거나, 더블클릭(file://)으로 열어 브라우저가 파일 읽기를 막으면 예시(data/example.js)로 대신한다
  function autoload() {
    if ($("#csv-input").value.trim()) return;
    function useExample(why) {
      if (!window.EXAMPLE_CSV) return;
      $("#csv-input").value = EXAMPLE_CSV;
      run();
      status($("#input-status").textContent + " · 예시 자동 불러옴" + (why ? " (" + why + ")" : ""));
    }
    if (!/^https?:$/.test(location.protocol) || !window.fetch) { useExample(); return; }
    fetch("data/latest.csv", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (text) {
        if (!text.trim() || $("#csv-input").value.trim()) { if (!text.trim()) useExample("latest.csv 비어 있음"); return; }
        $("#csv-input").value = text;
        run();
        status($("#input-status").textContent + " · data/latest.csv 자동 불러옴");
      })
      .catch(function () { useExample("latest.csv 없음"); });
  }
  $("#rules-version").textContent = window.RULES ? "기준 rules.js " + RULES.version : "";
  autoload();
})();
