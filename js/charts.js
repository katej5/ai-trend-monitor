// B · 요약 숫자·주제별 막대·주별 추이 (W7 · 연구원님). 약속은 js/README.md
window.ATM = window.ATM || {};

(function () {
  // 주제 색 (RULES.topics 순서대로). 미분류·전체는 회색
  var COLORS = ["#2f5bd3", "#d1495b", "#c98a12", "#00798c", "#6a4c93"];
  var GRAY = "#7a8291";
  var DAY = 86400000;

  function colorOf(topics, name) {
    var i = topics.indexOf(name);
    return i >= 0 ? COLORS[i % COLORS.length] : GRAY;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  // 자리 상자(.slot)를 그림 그릴 상자로 바꾼다. app.js가 '.slot'으로 다시 찾으므로 클래스는 남긴다
  function fill(el, html) {
    el.classList.add("filled");
    el.innerHTML = html;
  }

  function utc(d) { return Date.parse(d + "T00:00:00Z"); }
  function ymd(t) { return new Date(t).toISOString().slice(0, 10); }
  // 그 날짜가 든 주의 월요일
  function monday(t) { return t - ((new Date(t).getUTCDay() + 6) % 7) * DAY; }

  // ── 1. 요약 숫자 ────────────────────────────────────────────────
  // { total, classified, unclassified, skipped: [{ line, reason }] } → #summary 채우기
  ATM.renderSummary = function (stats) {
    var set = function (id, v) { document.getElementById(id).textContent = v; };
    set("stat-total", stats.total);
    set("stat-classified", stats.classified);
    set("stat-unclassified", stats.unclassified);
    set("stat-skipped", stats.skipped.length);
    // (v1.0) 분모·기간·기준 버전: 비율의 분모는 유효 기사 수(건너뛴 줄 제외)
    var meta = document.getElementById("summary-meta");
    if (meta && stats.total) {
      var pct = function (n) { return (n / stats.total * 100).toFixed(1) + "%"; };
      meta.textContent = "분류율 " + pct(stats.classified) + " · 미분류율 " + pct(stats.unclassified) + " (분모 = 유효 기사 " + stats.total + "건)" +
        (stats.firstDate ? " · 자료 날짜 " + stats.firstDate + " ~ " + stats.baseDate + " · 기준일 " + stats.baseDate : "") +
        (stats.rulesVersion ? " · 기준 rules.js " + stats.rulesVersion : "");
    } else if (meta) meta.textContent = "";
    document.getElementById("skipped-lines").textContent = stats.skipped.length
      ? "건너뛴 줄: " + stats.skipped.map(function (s) { return s.line + "번(" + s.reason + ")"; }).join(", ")
      : "";
  };

  // ── 2. 주제별 개수 ──────────────────────────────────────────────
  // el, items, ["주제", ...], onSelect(topic) → 가로 막대 + 미분류
  // 한 기사에 주제가 여러 개 붙을 수 있어 막대 합계는 총 건수보다 클 수 있다
  ATM.renderTopicCounts = function (el, items, topics, onSelect) {
    var rows = topics.map(function (name) {
      return { name: name, count: items.filter(function (it) { return it.topics.indexOf(name) >= 0; }).length, color: colorOf(topics, name) };
    });
    rows.push({ name: "미분류", count: items.filter(function (it) { return !it.topics.length; }).length, color: GRAY, other: true });
    var max = Math.max.apply(null, rows.map(function (r) { return r.count; }).concat(1));

    fill(el, '<ul class="bars">' + rows.map(function (r) {
      var w = (r.count / max * 100).toFixed(1);
      var label = '<span class="bar-name">' + esc(r.name) + "</span>" +
        '<span class="bar-track"><span class="bar-fill" style="width:' + w + "%;background:" + r.color + '"></span></span>' +
        '<span class="bar-value">' + r.count + "</span>";
      return "<li>" + (r.other
        ? '<div class="bar">' + label + "</div>"
        : '<button type="button" class="bar" aria-pressed="false" data-topic="' + esc(r.name) + '" title="추이에 함께 표시">' + label + "</button>") + "</li>";
    }).join("") + '</ul><p class="hint">막대를 누르면 주별 추이에 그 주제 선이 더해집니다. 한 기사에 주제가 여러 개 붙을 수 있어 합계는 총 건수보다 클 수 있습니다.</p>');

    Array.prototype.forEach.call(el.querySelectorAll("button.bar"), function (b) {
      b.addEventListener("click", function () {
        b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
        if (onSelect) onSelect(b.getAttribute("data-topic"));
      });
    });
  };

  // ── 3. 주별 추이 ────────────────────────────────────────────────
  // el, items, topics, selected, baseDate → 주별 꺾은선
  // - 주 시작일은 월요일. 첫 날짜가 든 주부터 기준일이 든 주까지
  // - 7일이 다 차지 않은 주(데이터 첫 주 · 기준일이 든 마지막 주)로 이어지는 선과 그 점은 점선·빈 점
  // - 늘 '전체' 선을 그리고, 막대에서 고른 주제 선을 함께 그린다
  ATM.renderTrend = function (el, items, topics, selected, baseDate) {
    if (!items.length) { fill(el, '<p class="hint">데이터가 없습니다.</p>'); return; }
    var first = items.reduce(function (m, it) { return it.date < m ? it.date : m; }, items[0].date);
    var start = monday(utc(first)), end = monday(utc(baseDate));
    var weeks = [];
    for (var t = start; t <= end; t += 7 * DAY) weeks.push(t);
    // (v1.0) 3주 미만이면 선으로 그리지 않는다: 점 한두 개를 '추이'로 읽지 않게
    if (weeks.length < 3) {
      fill(el, '<p class="hint">자료 날짜가 ' + first + " ~ " + baseDate + "(" + weeks.length + "주)뿐이라 주별 그래프를 그리지 않습니다. 3주 이상 자료를 넣으면 그립니다.</p>");
      return;
    }
    var partial = weeks.map(function (w) {
      return w < utc(first) || w + 6 * DAY > utc(baseDate); // 데이터가 그 주 월요일보다 늦게 시작 · 일요일 전에 끝남
    });
    function weekly(filter) {
      var c = weeks.map(function () { return 0; });
      items.forEach(function (it) {
        if (!filter(it)) return;
        c[Math.floor((monday(utc(it.date)) - start) / (7 * DAY))]++;
      });
      return c;
    }
    var series = [{ name: "전체", color: GRAY, data: weekly(function () { return true; }), total: true }];
    selected.forEach(function (name) {
      series.push({ name: name, color: colorOf(topics, name), data: weekly(function (it) { return it.topics.indexOf(name) >= 0; }) });
    });

    // SVG 좌표
    var W = 640, H = 260, L = 36, R = 12, T = 12, B = 32;
    var maxY = Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.data); }, [1]));
    var stepY = maxY <= 5 ? 1 : maxY <= 10 ? 2 : maxY <= 25 ? 5 : 10;
    maxY = Math.ceil(maxY / stepY) * stepY;
    var x = function (i) { return L + (weeks.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (weeks.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / maxY); };

    var svg = '<svg class="trend" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="주별 입력 건수">';
    for (var v = 0; v <= maxY; v += stepY) {
      svg += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text class="axis" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
    }
    var every = Math.ceil(weeks.length / 8);
    weeks.forEach(function (w, i) {
      if ((i % every === 0 && i < weeks.length - every / 2) || i === weeks.length - 1) {
        var anchor = i === 0 ? "start" : i === weeks.length - 1 ? "end" : "middle"; // 양 끝 날짜가 잘리지 않게
        svg += '<text class="axis" x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="' + anchor + '">' + ymd(w).slice(5).replace("-", "/") + "</text>";
      }
    });
    series.forEach(function (s) {
      for (var i = 1; i < s.data.length; i++) {
        var dash = partial[i] || partial[i - 1];
        svg += '<line x1="' + x(i - 1) + '" y1="' + y(s.data[i - 1]) + '" x2="' + x(i) + '" y2="' + y(s.data[i]) + '" stroke="' + s.color +
          '" stroke-width="' + (s.total ? 2 : 2.5) + '"' + (dash ? ' stroke-dasharray="5 4"' : "") + "/>";
      }
      s.data.forEach(function (d, i) {
        svg += '<circle cx="' + x(i) + '" cy="' + y(d) + '" r="3.5" stroke="' + s.color + '" stroke-width="2" fill="' + (partial[i] ? "#fff" : s.color) + '">' +
          "<title>" + esc(s.name) + " · " + ymd(weeks[i]) + " 주 · " + d + "건" + (partial[i] ? " (7일 안 참)" : "") + "</title></circle>";
      });
    });
    svg += "</svg>";

    var legend = '<ul class="legend">' + series.map(function (s) {
      return '<li><span class="swatch" style="background:' + s.color + '"></span>' + esc(s.name) + "</li>";
    }).join("") + '<li class="hint">점선 · 빈 점 = 7일이 다 차지 않은 주</li></ul>';
    var hint = '<p class="hint">넣은 자료의 날짜별 건수입니다. 수집한 사람·방식에 따라 달라지므로 세계 AI 동향의 증가·감소로 읽지 않습니다.' +
      (selected.length ? "" : " 주제별 개수 막대를 누르면 그 주제 선이 함께 표시됩니다.") + "</p>";
    fill(el, svg + legend + hint);
  };
})();
