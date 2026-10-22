// A · CSV 읽기·점검 (W6 · 유경). 약속은 js/README.md
window.ATM = window.ATM || {};

(function () {

// text → { rows: [{ line, date, title, url, source }], skipped: [{ line, reason }], records }
// - (v1.0) records = 머리글을 뺀 데이터 레코드 수. 검산(js/check.js)이 rows + skipped와 맞는지 본다
// - 첫 줄은 머리글(date,title,url,source)로 보고 건너뛴다. line은 그 줄이 시작하는 원본 줄 번호(머리글 = 1)
// - 큰따옴표로 감싼 칸 안의 쉼표·줄바꿈은 칸 구분으로 보지 않는다. 칸 안의 ""는 " 하나 (RFC 4180)
// - 빈 줄, 날짜 칸이 빈 줄, 날짜가 YYYY-MM-DD(실제 있는 날짜)가 아닌 줄은 rows에 넣지 않고 skipped에 줄 번호와 이유를 남긴다
//   (형식이 다른 날짜가 한 줄이라도 섞이면 기준일과 모든 점수가 깨지기 때문 · #21 리뷰)
ATM.parseCSV = function (text) {
  var records = readRecords(String(text || "").replace(/^\uFEFF/, ""));
  var rows = [], skipped = [];

  records.slice(1).forEach(function (rec) {
    var f = rec.fields;
    var empty = f.every(function (c) { return c.trim() === ""; });
    if (empty) { skipped.push({ line: rec.line, reason: "빈 줄" }); return; }
    var date = (f[0] || "").trim();
    if (!date) { skipped.push({ line: rec.line, reason: "날짜 없음" }); return; }
    if (!isDate(date)) { skipped.push({ line: rec.line, reason: "날짜 형식 오류 (YYYY-MM-DD 아님: " + date + ")" }); return; }
    rows.push({
      line: rec.line,
      date: date,
      title: (f[1] || "").trim(),
      url: (f[2] || "").trim(),
      source: (f[3] || "").trim()
    });
  });

  return { rows: rows, skipped: skipped, records: Math.max(0, records.length - 1) };
};

// "YYYY-MM-DD"이고 실제 있는 날짜인가 (2026-02-30 같은 날짜는 거름)
function isDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var t = Date.parse(s + "T00:00:00Z");
  return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

// 문자열 → [{ line, fields }]. 따옴표 안이 아닌 줄바꿈에서 레코드를 끊는다
function readRecords(s) {
  var out = [], fields = [], cell = "";
  var line = 1, start = 1, quoted = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") { quoted = true; }
    else if (ch === ",") { fields.push(cell); cell = ""; }
    else if (ch === "\r") { /* CRLF의 CR은 버림 */ }
    else if (ch === "\n") {
      fields.push(cell);
      out.push({ line: start, fields: fields });
      fields = []; cell = ""; line++; start = line;
    }
    else { cell += ch; }
  }
  // 마지막 줄 (파일 끝에 줄바꿈이 없을 때)
  if (cell !== "" || fields.length) { fields.push(cell); out.push({ line: start, fields: fields }); }
  return out;
}
})();
