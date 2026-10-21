// A · 주제 분류·출처 등급·중요도 (W6 · 유경). 약속은 js/README.md, 규칙은 rules.js 맨 위 「적용 방식」
window.ATM = window.ATM || {};

(function () {
  var GRADE_ORDER = "ABCD";

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // 비교 전 정리: 소문자 + 특수 하이픈(‐ ‑ ‒ – —)을 '-'로 (keywords.js도 같이 씀)
  ATM.normalize = function (s) {
    return String(s || "").toLowerCase().replace(/[‐‑‒–—]/g, "-");
  };

  // en 낱말 일치: 앞 글자는 영문자·숫자·점이 아니고, 뒤 글자는 영문자가 아니어야 함
  function enHit(t, w) {
    return new RegExp("(^|[^a-z0-9.])" + esc(ATM.normalize(w)) + "($|[^a-z])").test(t);
  }

  // { en, ko } 목록에서 제목 t에 걸린 낱말 (적힌 모양 그대로)
  function hitsOf(t, spec) {
    return (spec.en || []).filter(function (w) { return enHit(t, w); })
      .concat((spec.ko || []).filter(function (w) { return t.indexOf(ATM.normalize(w)) >= 0; }));
  }

  // 주제 이름 → 걸린 근거 [{ rule, words }] (rules.js 「적용 방식」 1절)
  // - rule "낱말": en·ko 목록에서 걸린 낱말
  // - rule = 복합 조건 이름: combos의 all 묶음마다 하나 이상 걸렸을 때, 묶음별로 걸린 낱말
  // 근거가 하나도 없거나 exclude에 걸린 주제는 빠진다. 키 순서 = RULES.topics 순서
  function topicMatches(title, rules) {
    var t = ATM.normalize(title), out = {};
    Object.keys(rules.topics).forEach(function (name) {
      var p = rules.topics[name];
      if (p.exclude.some(function (x) { return t.indexOf(ATM.normalize(x)) >= 0; })) return;
      var why = [], single = hitsOf(t, p);
      if (single.length) why.push({ rule: "낱말", words: single });
      (p.combos || []).forEach(function (c) {
        var parts = c.all.map(function (g) { return hitsOf(t, g); });
        if (parts.every(function (h) { return h.length > 0; })) why.push({ rule: c.name, words: [].concat.apply([], parts) });
      });
      if (why.length) out[name] = why;
    });
    return out;
  }

  // 등급표에서 가장 긴 domain, 그다음 pathPrefix가 있는 줄. 없으면 null
  function sourceOf(url, rules) {
    var host = "", path = "/";
    try { var u = new URL(url); host = u.hostname.replace(/^www\./, ""); path = u.pathname; } catch (e) { return null; }
    var hits = rules.sources.filter(function (s) {
      return (host === s.domain || host.slice(-(s.domain.length + 1)) === "." + s.domain) &&
             (!s.pathPrefix || path.indexOf(s.pathPrefix) === 0);
    });
    hits.sort(function (a, b) {
      return (b.domain.length - a.domain.length) || ((b.pathPrefix ? 1 : 0) - (a.pathPrefix ? 1 : 0));
    });
    return hits[0] || null;
  }

  function daysBetween(a, b) { // "YYYY-MM-DD" 두 개 → b - a (일)
    return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
  }

  // rows, RULES → [{ line, date, title, url, source, grade, gradeReason, gradeType, oa, unregistered, topics, why, keywords, similar, score }]
  ATM.classify = function (rows, rules) {
    var items = rows.map(function (r) {
      var src = sourceOf(r.url, rules);
      var why = topicMatches(r.title, rules);
      return {
        line: r.line, date: r.date, title: r.title, url: r.url, source: r.source,
        grade: src ? src.grade : rules.unknownGrade,
        gradeReason: src ? src.reason : "등급표에 없는 도메인 (기본 등급)",
        gradeType: src ? src.type : "미등록",
        oa: src ? src.oa : null,
        unregistered: !src,
        topics: Object.keys(why),
        why: why,
        keywords: ATM.extractKeywords(r.title, rules)
      };
    });

    // 중요도 = 등급 가중치 × (1 + 비슷한 기사 수) × 0.5 ^ (경과일 ÷ 반감기). 기준일 = 가장 늦은 날짜
    var base = items.reduce(function (m, it) { return it.date > m ? it.date : m; }, "");
    var S = rules.score;
    items.forEach(function (it) {
      it.similar = items.filter(function (o) {
        if (o === it || o.date !== it.date) return false;
        if (!o.topics.some(function (t) { return it.topics.indexOf(t) >= 0; })) return false;
        var shared = o.keywords.filter(function (k) { return it.keywords.indexOf(k) >= 0; }).length;
        return shared >= S.overlap;
      }).map(function (o) { return o.line; });
      var age = daysBetween(it.date, base);
      it.score = rules.gradeWeight[it.grade] * (1 + it.similar.length) * Math.pow(0.5, age / S.recencyHalfLifeDays);
    });
    return items;
  };

  // 중요도 순위 비교 (rules.js 「3. 중요도」의 동점 규칙): 점수 → 날짜 최신 → 등급 → 줄 번호
  // 쓰는 법: items.slice().sort(ATM.byImportance)
  ATM.byImportance = function (a, b) {
    return (b.score - a.score) ||
           (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
           (GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade)) ||
           (a.line - b.line);
  };
})();
