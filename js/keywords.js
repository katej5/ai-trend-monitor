// A · 키워드 추출·기간별 순위 (W8 · 유경). 약속은 js/README.md
// extractKeywords는 classify의 '비슷한 기사' 계산에 필요해서 W6에서 먼저 구현했다 (#12). keywordRanks는 W8 (#14).
window.ATM = window.ATM || {};

(function () {
  var HANGUL = /[가-힣]/;
  var HANGUL_ALL = /[가-힣]/g;
  var TOKEN = /[a-z0-9가-힣]+(?:[-.][a-z0-9가-힣]+)*/g;

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // title, RULES → ["EU AI Act", ...] (한 기사 안에서 중복 없음). 규칙은 rules.js 맨 위 「4. 키워드」
  ATM.extractKeywords = function (title, rules) {
    var K = rules.keywords;
    var t = ATM.normalize(title);
    var out = [];
    function add(k) { if (out.indexOf(k) < 0) out.push(k); }

    // 1) 구를 긴 것부터 찾아 한 덩어리로 세고 제목에서 지운다
    K.phrases.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (p) {
      var pn = ATM.normalize(p);
      if (HANGUL.test(pn)) {
        if (t.indexOf(pn) >= 0) { add(p); t = t.split(pn).join(" "); }
      } else {
        var re = new RegExp("(^|[^a-z0-9.])" + esc(pn) + "(?=$|[^a-z])", "g");
        if (re.test(t)) { add(p); re.lastIndex = 0; t = t.replace(re, "$1 "); }
      }
    });

    // 2) 나머지 낱말
    var stopEn = K.stopwords.en.map(function (w) { return w.toLowerCase(); });
    var stopKo = K.stopwords.ko.map(function (w) { return w.toLowerCase(); });
    var particles = K.particles.slice().sort(function (a, b) { return b.length - a.length; });
    var dropEn = new RegExp(K.dropEnPattern);

    (t.match(TOKEN) || []).forEach(function (tok) {
      var w = tok;
      if (HANGUL.test(tok)) {
        for (var i = 0; i < particles.length; i++) {
          var pa = particles[i];
          if (w.length - pa.length >= K.minKo && w.slice(-pa.length) === pa) { w = w.slice(0, -pa.length); break; }
        }
        var syllables = (w.match(HANGUL_ALL) || []).length;
        var dropKo = K.dropKoEndings.some(function (e) { return w.slice(-e.length) === e; });
        if (syllables < K.minKo || stopKo.indexOf(w) >= 0 || dropKo) return;
      } else {
        if (!/[a-z]/.test(tok) || tok.length < K.minEn || stopEn.indexOf(tok) >= 0 || dropEn.test(tok)) return;
      }
      add(w);
    });
    return out;
  };

  function daysBetween(a, b) { // "YYYY-MM-DD" 두 개 → b - a (일)
    return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
  }

  // items, "YYYY-MM-DD"[, RULES] → { "90d" | "30d" | "7d" | "1d": { window, label, days, rank: [{ keyword, count, prev }] } }
  // - 기간: 기준일을 포함해 거꾸로 days일. prev = 그 바로 앞 같은 길이의 기간에 나온 건수
  // - 건수는 그 키워드가 들어간 기사 수 (classify가 기사마다 중복 없이 뽑아 둔 item.keywords로 셈)
  // - 순위: 건수 → 직전 기간 건수 → 글자 코드 순서. 상위 rules.keywords.topN개
  // - rules를 안 넘기면 전역 RULES를 쓴다 (app.js는 두 인자로 부름)
  ATM.keywordRanks = function (items, baseDate, rules) {
    var K = (rules || window.RULES).keywords;
    var out = {};
    K.windows.forEach(function (w) {
      var cur = Object.create(null), prev = Object.create(null); // "constructor" 같은 키워드도 안전하게
      items.forEach(function (it) {
        var age = daysBetween(it.date, baseDate);
        var bucket = age >= 0 && age < w.days ? cur : (age >= w.days && age < 2 * w.days ? prev : null);
        if (!bucket) return;
        (it.keywords || []).forEach(function (k) { bucket[k] = (bucket[k] || 0) + 1; });
      });
      var rank = Object.keys(cur).map(function (k) {
        return { keyword: k, count: cur[k], prev: prev[k] || 0 };
      }).sort(function (a, b) {
        return (b.count - a.count) || (b.prev - a.prev) || (a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0);
      }).slice(0, K.topN);
      // (v1.0) 직전 기간에 실제로 자료가 있는 날 수: 자료가 직전 기간보다 늦게 시작하면 증감 비교가 불완전하다
      var firstAge = items.reduce(function (m, it) { return Math.max(m, daysBetween(it.date, baseDate)); }, 0);
      var prevDaysCovered = Math.max(0, Math.min(2 * w.days - 1, firstAge) - w.days + 1);
      out[w.id] = { window: w.id, label: w.label, days: w.days, rank: rank, prevDaysCovered: prevDaysCovered };
    });
    return out;
  };
})();
