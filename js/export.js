// B · 내보내기 (W9 · 연구원님). 약속은 js/README.md
window.ATM = window.ATM || {};

(function () {
  // RFC 4180: 쉼표 · 큰따옴표 · 줄바꿈이 든 칸은 큰따옴표로 감싸고, 안의 "는 ""로
  function cell(v) {
    var s = String(v == null ? "" : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // items → CSV 문자열 (다시 넣으면 같은 결과 · 기획안 완료 기준 5)
  // - 앞 네 칸은 입력과 같은 date,title,url,source → parseCSV로 다시 읽으면 같은 rows가 됨
  // - 뒤에 분석 결과(topics · grade · score)를 덧붙인다. parseCSV는 다섯째 칸부터 읽지 않으므로 다시 넣어도 결과는 같다
  // - 순서는 입력 순서 그대로 (줄 번호가 바뀌어도 상대 순서가 같아 동점 규칙 결과도 같음)
  // - (v1.0) 맨 뒤 evidence = 주제별 분류 근거 "주제: 규칙: 낱말 + 낱말" (분류 근거를 파일로도 확인)
  ATM.toCSV = function (items) {
    var lines = ["date,title,url,source,topics,grade,score,evidence"];
    items.forEach(function (it) {
      lines.push([it.date, it.title, it.url, it.source, it.topics.join(" | "), it.grade, it.score.toFixed(4), evidence(it)].map(cell).join(","));
    });
    return lines.join("\n") + "\n";
  };

  function whyOf(it, t) {
    return ((it.why && it.why[t]) || []).map(function (w) { return w.rule + ": " + w.words.join(" + "); }).join(" / ");
  }
  function evidence(it) {
    return it.topics.map(function (t) { return t + ": " + whyOf(it, t); }).join(" | ");
  }

  function url(u) { return String(u || "").replace(/[()\s]/g, encodeURIComponent); } // 마크다운 링크가 끊기지 않게
  function md(s) { return String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\r?\n/g, " "); }
  function topicNames(items) {
    if (window.RULES && RULES.topics) return Object.keys(RULES.topics);
    var seen = [];
    items.forEach(function (it) { it.topics.forEach(function (t) { if (seen.indexOf(t) < 0) seen.push(t); }); });
    return seen;
  }

  // items, ranks, stats → 마크다운 문자열 (대시보드 요약 · 메일·보고서에 붙여 넣기용)
  ATM.toMarkdown = function (items, ranks, stats) {
    var base = items.reduce(function (m, it) { return it.date > m ? it.date : m; }, "");
    var topics = topicNames(items);
    var n = window.RULES && RULES.score && RULES.score.topN || 5;
    var out = [];

    out.push("# AI 동향 모니터 요약", "", "- 기준일: " + base + (stats.firstDate ? " (자료 날짜 " + stats.firstDate + " ~ " + base + ")" : ""),
      "- 기준: rules.js " + (window.RULES ? RULES.version : "") + " · 규칙만으로 계산(도구 안 AI 호출 없음) · 제목만 읽음",
      "- 총 " + stats.total + "건 · 분류됨 " + stats.classified + " · 미분류 " + stats.unclassified + " · 건너뛴 줄 " + stats.skipped.length,
      "- 넣은 자료의 분포이며 세계 AI 동향 전체를 뜻하지 않음. 한 기사에 주제가 여러 개 붙을 수 있어 주제별 합계는 총 건수보다 클 수 있음");
    if (stats.skipped.length) {
      out.push("- 건너뛴 줄: " + stats.skipped.map(function (s) { return s.line + "번(" + md(s.reason) + ")"; }).join(", "));
    }

    out.push("", "## 주제별 개수", "", "| 주제 | 건수 |", "|---|---:|");
    topics.forEach(function (t) {
      out.push("| " + md(t) + " | " + items.filter(function (it) { return it.topics.indexOf(t) >= 0; }).length + " |");
    });
    out.push("| 미분류 | " + stats.unclassified + " |");

    out.push("", "## 주제별 읽기 우선순위 상위 " + n + "건 (규칙 기반 · 객관적 중요도 아님)");
    topics.forEach(function (t) {
      var top = items.filter(function (it) { return it.topics.indexOf(t) >= 0; }).sort(ATM.byImportance).slice(0, n);
      out.push("", "### " + md(t), "");
      if (!top.length) { out.push("- (없음)"); return; }
      top.forEach(function (it, i) {
        out.push((i + 1) + ". [" + md(it.title) + "](" + url(it.url) + ") — " + it.date + " · " + md(it.source) + " · " + it.grade + " · " + it.score.toFixed(2) + " · 근거 " + md(whyOf(it, t)));
      });
    });

    if (ranks) {
      out.push("", "## 기간별 키워드 상위", "", "| 기간 | 키워드 (건수/직전) |", "|---|---|");
      Object.keys(ranks).forEach(function (k) {
        var r = ranks[k];
        out.push("| " + md(r.label || r.window) + " | " + (r.rank.map(function (x) { return md(x.keyword) + " " + x.count + "/" + x.prev; }).join(" · ") || "(없음)") + " |");
      });
    }

    var un = items.filter(function (it) { return !it.topics.length; });
    out.push("", "## 미분류 " + un.length + "건", "");
    un.forEach(function (it) { out.push("- " + it.date + " [" + md(it.title) + "](" + url(it.url) + ") · " + md(it.source)); });

    return out.join("\n") + "\n";
  };
})();
