/* Selbsttest Zahlenmauer: node worksheets/math/number-wall/selftest.js
   Prüft je Stufe und Rechenart 500 Seeds (je 4 Mauern) plus Stichproben der
   Feineinstellung: Rechenregel, Zahlen natürlich und im Zahlenraum, eindeutig
   lösbar (Rang = Grundsteine, unabhängig vom Generator nachgerechnet),
   Vorgaben-Regel der Stufe, kein Rückfall, gleiche Seeds = gleiches Blatt,
   nur WinAnsi-Zeichen im Blatt. Ausgabe nur bei Fehlern, sonst eine Zeile. */
"use strict";
var path = require("path");
global.window = global;
require(path.join(__dirname, "..", "..", "sheet.js"));
var S = global.Sheet;
var NW = require(path.join(__dirname, "wall.js"));

var fails = [], walls = 0;
function fail(msg) { if (fails.length < 30) fails.push(msg); else fails.length++; }

// Eigener Rang über Brüche (double mit Pivot-Suche reicht nicht als Beweis,
// darum exakt mit BigInt-Brüchen: Zeilen skalieren statt teilen).
function rankExact(vecs) {
  var m = vecs.map(function (v) { return v.map(function (x) { return BigInt(x); }); });
  var r = 0, cols = m.length ? m[0].length : 0;
  for (var c = 0; c < cols && r < m.length; c++) {
    var p = m.findIndex(function (row, i) { return i >= r && row[c] !== 0n; });
    if (p < 0) continue;
    var t = m[r]; m[r] = m[p]; m[p] = t;
    for (var j = 0; j < m.length; j++) {
      if (j === r || m[j][c] === 0n) continue;
      var f = m[j][c], g = m[r][c];
      m[j] = m[j].map(function (x, k) { return x * g - m[r][k] * f; });
    }
    r++;
  }
  return r;
}

var WIN_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function winAnsiOk(s) {
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (!((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN_EXTRA.indexOf(s[i]) >= 0)) return false;
  }
  return true;
}

function checkWall(w, p, tag) {
  walls++;
  var n = w.n, tot = n * (n + 1) / 2;
  if (w.fallback) fail(tag + " Rückfall");
  if (n < p.nMin || n > p.nMax) fail(tag + " n=" + n);
  if (w.vals.length !== tot || w.given.length !== tot) fail(tag + " Länge");
  w.vals.forEach(function (x) {
    if (!Number.isInteger(x) || x < 1 || x > p.zr) fail(tag + " Wert " + x + " (zr " + p.zr + ")");
  });
  NW.relations(n).forEach(function (rel) {
    var o = w.vals[rel[0]], l = w.vals[rel[1]], r = w.vals[rel[2]];
    if (p.op === "mul" ? o !== l * r : o !== l + r) fail(tag + " Regel verletzt");
  });
  var top = w.vals[tot - 1];
  if (top < p.minTop) fail(tag + " Spitze " + top + " < " + p.minTop);
  // Eindeutig: Koeffizienten unabhängig aufbauen (Pascal) und Rang prüfen.
  var co = [], r, i, k = 0;
  for (r = 0; r < n; r++) {
    for (i = 0; i < n - r; i++) {
      var v = new Array(n).fill(0);
      for (var t = 0; t <= r; t++) { var b = 1; for (var q = 1; q <= t; q++) b = b * (r - t + q) / q; v[i + t] = Math.round(b); }
      co.push(v); k++;
    }
  }
  var gv = co.filter(function (_, j) { return w.given[j]; });
  if (rankExact(gv) !== n) fail(tag + " nicht eindeutig (Rang " + rankExact(gv) + ")");
  var nGiven = gv.length, baseEmpty = 0;
  for (i = 0; i < n; i++) if (!w.given[i]) baseEmpty++;
  if (p.mode === "base") {
    if (baseEmpty || nGiven !== n) fail(tag + " Grundreihe nicht genau vorgegeben");
  } else {
    if (nGiven !== Math.min(tot, n + p.extra)) fail(tag + " Vorgaben " + nGiven);
    if (baseEmpty < Math.min(p.baseGaps, n - 1)) fail(tag + " unten zu wenig Lücken");
    if (p.prop && !NW.propagate(n, w.given)) fail(tag + " nicht Stein für Stein lösbar");
  }
}

function checkPages(st, sh, tag) {
  [false, true].forEach(function (sol) {
    var page = NW.drawPage(S, st, sh, sol);
    page.ops.forEach(function (o) {
      if (o.t === "text" && !winAnsiOk(o.s)) fail(tag + " Nicht-WinAnsi: " + JSON.stringify(o.s));
      if (o.t === "rect" && (o.x < 0 || o.y < 0 || o.x + o.w > S.W + 0.01 || o.y + o.h > S.H - 15)) fail(tag + " Stein außerhalb");
    });
  });
}

var t0 = Date.now();
NW.LEVEL_ORDER.forEach(function (level) {
  ["plus", "mul"].forEach(function (op) {
    for (var seed = 1; seed <= 500; seed++) {
      var st = { level: level, op: op, count: [2, 4, 6, 8][seed % 4], base: 0, zr: 0,
        title: "Zahlenmauern", name: true, solution: true, seed: seed * 7919 };
      var sh = NW.build(st, S.rng);
      sh.walls.forEach(function (w, j) { checkWall(w, sh.p, level + "/" + op + "/s" + seed + "/w" + j); });
      if (seed <= 40) checkPages(st, sh, level + "/" + op + "/s" + seed);
      if (seed <= 20 && JSON.stringify(NW.build(st, S.rng).walls) !== JSON.stringify(sh.walls)) fail(level + " nicht deterministisch");
    }
  });
});

// Feineinstellung: alle Grundsteine x Zahlenräume, je Stufe-Modus.
["starter", "grade2", "master", "crazy"].forEach(function (level) {
  ["plus", "mul"].forEach(function (op) {
    [3, 4, 5, 6, 7].forEach(function (base) {
      [0].concat(NW.ZR_OPTIONS).forEach(function (zr) {
        for (var seed = 1; seed <= 15; seed++) {
          var st = { level: level, op: op, count: 2, base: base, zr: zr, title: "Test ÄÖÜß ← × · 🙂",
            name: true, solution: true, seed: seed * 104729 + base };
          var sh = NW.build(st, S.rng), tag = level + "/" + op + "/b" + base + "/z" + zr + "/s" + seed;
          sh.walls.forEach(function (w, j) { checkWall(w, sh.p, tag + "/w" + j); });
          if (seed === 1) checkPages(st, sh, tag);
        }
      });
    });
  });
});

// Englisches Blatt (/en/worksheets/): gleiche Prüfungen, Texte englisch, × im Blatt.
S.lang = "en"; NW.setLang("en");
["starter", "grade2", "crazy"].forEach(function (level) {
  ["plus", "mul"].forEach(function (op) {
    var st = { level: level, op: op, count: 8, base: 7, zr: 10, title: "", name: true, solution: true, seed: 31 };
    var sh = NW.build(st, S.rng), tag = "en/" + level + "/" + op;
    checkPages(st, sh, tag);
    var txt = [false, true].map(function (sol) {
      return NW.drawPage(S, st, sh, sol).ops.filter(function (o) { return o.t === "text"; })
        .map(function (o) { return o.s; }).join("|");
    }).join("|");
    if (!/Answer key/.test(txt) || !/Date:/.test(txt) || !/remindery\.de\/en\/worksheets/.test(txt)) fail(tag + " englische Texte fehlen");
    if (op === "mul" && !/×/.test(txt)) fail(tag + " Malzeichen fehlt");
    if (op === "mul" && sh.p.notes.join().indexOf("multiplication pyramids") < 0) fail(tag + " englische Hinweise fehlen");
    if (/Lösung|Mauer|Rechne/.test(txt)) fail(tag + " deutscher Text im englischen Blatt");
  });
});
S.lang = "de"; NW.setLang("de");

if (fails.length) {
  console.log("FEHLER (" + fails.length + "):\n" + fails.slice(0, 30).join("\n"));
  process.exit(1);
}
console.log("OK: " + walls + " Mauern geprüft in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
