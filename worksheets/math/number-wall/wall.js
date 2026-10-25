/* Zahlenmauer: reine Logik (Erzeugen, Prüfen, Blatt zeichnen). Läuft im
   Browser (window.NumberWall) und in Node (module.exports, für selftest.js).
   Kein DOM-Zugriff; gezeichnet wird über die übergebene Sheet-Basis.

   Didaktik abgestimmt mit Rätselblock (apps/raetselblock/lib/kern/arten/
   rechnen/zahlenmauer.dart): erst nur die Grundreihe vorgegeben, dann Lücken
   auch unten (ergänzen = rückwärts rechnen), schwerer über mehr Steine und
   weniger Vorgaben; keine Zahl dreimal in einer Mauer.

   Harte Regel: jede Mauer ist eindeutig lösbar. Jeder Stein ist eine
   Linearkombination der Grundsteine (Binomialkoeffizienten); die Vorgaben
   müssen Rang = Anzahl Grundsteine haben. Für Malmauern gilt dasselbe im
   Log-Raum (log(a·b) = log a + log b), die Koeffizienten sind identisch. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NumberWall = api;
})(this, function () {
  "use strict";

  // Stufen. n = Grundsteine [min, max], zr = Zahlenraum (größte Zahl = Spitze),
  // minTop = kleinste Spitze (damit die Stufe sichtbar ist), mode "base" =
  // nur die Grundreihe vorgegeben, "mixed" = n + extra Vorgaben verteilt,
  // baseGaps = so viele Grundsteine mindestens leer, prop = ohne
  // Gleichungssystem lösbar (Stein für Stein). mul = Werte für Malmauern
  // (Grundsteine, Zahlenraum, optional eigenes extra).
  var LEVELS = {
    starter: { label: "Anfänger", n: [3, 3], zr: 10, minTop: 5, mode: "base",
      mul: { n: 3, zr: 20 } },
    grade1: { label: "Klasse 1", n: [4, 4], zr: 20, minTop: 11, mode: "base",
      mul: { n: 3, zr: 50 } },
    grade2: { label: "Klasse 2", n: [4, 4], zr: 100, minTop: 30, mode: "mixed", extra: 1,
      baseGaps: 1, prop: true, mul: { n: 3, zr: 100 } },
    pro: { label: "Profi", n: [4, 4], zr: 1000, minTop: 200, mode: "mixed", extra: 0,
      baseGaps: 1, prop: true, mul: { n: 4, zr: 1000, extra: 1 } },
    master: { label: "Meister", n: [5, 5], zr: 1000, minTop: 300, mode: "mixed", extra: 0,
      baseGaps: 2, prop: true, mul: { n: 4, zr: 1000 } },
    crazy: { label: "Verrückt", n: [6, 7], zr: 10000, minTop: 2000, mode: "mixed", extra: 0,
      baseGaps: 2, prop: false, mul: { n: 4, zr: 5000 } }
  };
  // Sprache: aus <html lang> im Browser, in Node "de" (setLang für den Selbsttest).
  var lang = typeof document !== "undefined" && document.documentElement &&
    /^en\b/i.test(document.documentElement.lang || "") ? "en" : "de";
  var STR = {
    de: {
      mulMaxBase: function () { return "Malmauern haben höchstens 4 Grundsteine"; },
      zrRaised: function (z) { return "Zahlenraum auf " + z + " angehoben"; },
      zrCapped: function (z) { return "Zahlenraum auf " + z + " begrenzt"; },
      maxCount: function (c) { return "ab 6 Grundsteinen höchstens " + c + " Mauern (Platz zum Schreiben)"; },
      titlePlus: "Zahlenmauern", titleMul: "Malmauern", tag: "Lösung",
      // Malpunkt statt ×: so steht es in Grundschulheften. Beides ist WinAnsi.
      instrMul: "Rechne mal: Zwei Steine nebeneinander ergeben den Stein darüber, z. B. 2 · 3 = 6.",
      instrPlus: "Rechne plus: Zwei Steine nebeneinander ergeben den Stein darüber, z. B. 2 + 3 = 5."
    },
    en: {
      mulMaxBase: function () { return "multiplication pyramids have at most 4 bottom blocks"; },
      zrRaised: function (z) { return "number range raised to " + z.toLocaleString("en-US"); },
      zrCapped: function (z) { return "number range capped at " + z.toLocaleString("en-US"); },
      maxCount: function (c) { return "at most " + c + " pyramids with 6 or more bottom blocks (room to write)"; },
      titlePlus: "Number Pyramids", titleMul: "Multiplication Pyramids", tag: "Answer key",
      // English worksheets use × for multiplication (WinAnsi 0xD7).
      instrMul: "Multiply the two blocks side by side and write the product above: 2 × 3 = 6.",
      instrPlus: "Add the two blocks side by side and write the sum in the block above: 2 + 3 = 5."
    }
  };
  function T() { return STR[lang] || STR.de; }
  function setLang(l) { lang = l === "en" ? "en" : "de"; }

  var LEVEL_ORDER = ["starter", "grade1", "grade2", "pro", "master", "crazy"];
  var ZR_OPTIONS = [10, 20, 50, 100, 200, 500, 1000, 5000, 10000];
  var COUNTS = [2, 4, 6, 8];
  var MIN_N = 3, MAX_N = 7, MAX_N_MUL = 4, MAX_COUNT_BIG = 3;
  // Kleinste mögliche Spitze (Plus: alles 1; Mal: höchstens eine 1).
  var MUL_FEAS = { 3: 4, 4: 32 };
  // Größte erreichbare Spitze einer 3er-Malmauer mit den Einmaleins-Grenzen.
  var MUL3_MAX_ZR = 1000;

  function binom(n, k) {
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  }

  // Stein (Reihe r, 0 = unten; Position i) bei n Grundsteinen.
  function idx(n, r, i) { return r * n - (r * (r - 1)) / 2 + i; }
  function total(n) { return n * (n + 1) / 2; }
  function rowOf(n, k) {
    for (var r = 0; r < n; r++) { if (k < idx(n, r + 1, 0) || r === n - 1) return [r, k - idx(n, r, 0)]; }
    return null;
  }
  // Beziehungen [oben, links, rechts].
  function relations(n) {
    var out = [];
    for (var r = 1; r < n; r++) {
      for (var i = 0; i < n - r; i++) out.push([idx(n, r, i), idx(n, r - 1, i), idx(n, r - 1, i + 1)]);
    }
    return out;
  }
  // Koeffizientenvektor eines Steins über den Grundsteinen.
  function coeff(n, k) {
    var ri = rowOf(n, k), v = [];
    for (var j = 0; j < n; j++) v.push(0);
    for (var t = 0; t <= ri[0]; t++) v[ri[1] + t] = binom(ri[0], t);
    return v;
  }

  function values(base, op) {
    var n = base.length, v = base.slice();
    relations(n).forEach(function (rel) {
      v[rel[0]] = op === "mul" ? v[rel[1]] * v[rel[2]] : v[rel[1]] + v[rel[2]];
    });
    return v;
  }

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }

  // Rang ganzzahliger Vektoren (bruchfreie Elimination, exakt).
  function rank(vectors) {
    if (!vectors.length) return 0;
    var m = vectors.map(function (v) { return v.slice(); });
    var cols = m[0].length, r = 0;
    for (var c = 0; c < cols && r < m.length; c++) {
      var p = -1;
      for (var i = r; i < m.length; i++) { if (m[i][c] !== 0) { p = i; break; } }
      if (p < 0) continue;
      var tmp = m[r]; m[r] = m[p]; m[p] = tmp;
      for (var j = r + 1; j < m.length; j++) {
        if (m[j][c] === 0) continue;
        var f = m[j][c], g = m[r][c], row = [], d = 0;
        for (var k = 0; k < cols; k++) { row.push(m[j][k] * g - m[r][k] * f); d = gcd(d, row[k]); }
        if (d > 1) row = row.map(function (x) { return x / d; });
        m[j] = row;
      }
      r++;
    }
    return r;
  }

  // Stein für Stein: eine Beziehung mit zwei bekannten Steinen liefert den
  // dritten. Gibt die Reihenfolge der gefundenen Steine zurück oder null.
  function propagate(n, given) {
    var k = given.slice(), order = [], rels = relations(n), changed = true;
    while (changed) {
      changed = false;
      for (var q = 0; q < rels.length; q++) {
        var miss = rels[q].filter(function (f) { return !k[f]; });
        if (miss.length === 1) { k[miss[0]] = true; order.push(miss[0]); changed = true; }
      }
    }
    return k.every(Boolean) ? order : null;
  }

  function uniquelySolvable(n, given) {
    var vecs = [];
    given.forEach(function (g, k) { if (g) vecs.push(coeff(n, k)); });
    return rank(vecs) === n;
  }

  // ---------- Parameter aus Stufe + Feineinstellung ----------

  function feasMin(n, op) { return op === "mul" ? MUL_FEAS[n] : Math.pow(2, n - 1); }

  function params(st) {
    var L = LEVELS[st.level] || LEVELS.grade2, mul = st.op === "mul", notes = [];
    var nMin = mul ? L.mul.n : L.n[0], nMax = mul ? L.mul.n : L.n[1];
    if (st.base) {
      nMin = nMax = Math.max(MIN_N, Math.min(MAX_N, st.base));
      if (mul && nMax > MAX_N_MUL) { nMin = nMax = MAX_N_MUL; notes.push(T().mulMaxBase()); }
    }
    var custom = !!(st.base || st.zr);
    var zr = st.zr || (mul ? L.mul.zr : L.zr);
    var feas = feasMin(nMax, st.op);
    if (zr < 2 * feas) {
      zr = ZR_OPTIONS.filter(function (z) { return z >= 2 * feas; })[0];
      notes.push(T().zrRaised(zr));
    }
    if (mul && nMax === 3 && zr > MUL3_MAX_ZR) { zr = MUL3_MAX_ZR; notes.push(T().zrCapped(zr)); }
    var minTop = custom ? Math.floor(zr * (mul ? 0.2 : 0.3)) : (mul ? Math.floor(zr * 0.2) : L.minTop);
    minTop = Math.max(minTop, feas);
    // Ab 6 Grundsteinen passen nur 3 Mauern aufs Blatt, wenn die Steine groß
    // genug zum Hineinschreiben bleiben sollen (mindestens 10 mm hoch).
    var count = COUNTS.indexOf(st.count) >= 0 ? st.count : 4;
    if (nMax >= 6 && count > MAX_COUNT_BIG) { count = MAX_COUNT_BIG; notes.push(T().maxCount(MAX_COUNT_BIG)); }
    return { nMin: nMin, nMax: nMax, zr: zr, minTop: minTop, op: mul ? "mul" : "plus", count: count,
      mode: L.mode, extra: (mul && L.mul.extra != null ? L.mul.extra : L.extra) || 0, baseGaps: L.baseGaps || 0, prop: !!L.prop, notes: notes };
  }

  // ---------- Erzeugen ----------

  function tripleFree(v) {
    var c = {};
    for (var i = 0; i < v.length; i++) { c[v[i]] = (c[v[i]] || 0) + 1; if (c[v[i]] > 2) return false; }
    return true;
  }

  function sampleBase(rand, n, p, minTop) {
    var top = total(n) - 1, tries = p.op === "mul" ? 8000 : 600;
    for (var t = 0; t < tries; t++) {
      var base = [];
      if (p.op === "mul") {
        var ones = 0;
        for (var i = 0; i < n; i++) {
          var e = binom(n - 1, i), maxV = e >= 3 ? 4 : e === 2 ? 6 : 9;
          var b = 1 + Math.floor(rand() * maxV);
          if (b === 1) ones++;
          base.push(b);
        }
        if (ones > 1) continue;
      } else {
        // Zielspitze ziehen und mit zufälligen Gewichten verteilen.
        var T = minTop + Math.floor(rand() * (p.zr - minTop + 1)), w = [], s = 0;
        for (var j = 0; j < n; j++) { w.push(0.25 + rand() * 0.75); s += binom(n - 1, j) * w[j]; }
        for (var k = 0; k < n; k++) base.push(Math.max(1, Math.round(w[k] * T / s)));
      }
      var v = values(base, p.op);
      if (v[top] < minTop || v[top] > p.zr) continue;
      if (t < tries * 0.75 && !tripleFree(v)) continue;
      return v;
    }
    return null;
  }

  function shuffle(a, rand) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function pickGivens(rand, n, p) {
    var tot = total(n), given = [], i;
    if (p.mode === "base") {
      for (i = 0; i < tot; i++) given.push(i < n);
      return given;
    }
    var want = Math.min(tot, n + p.extra), all = [];
    for (i = 0; i < tot; i++) all.push(i);
    var gaps = Math.min(p.baseGaps, n - 1);
    for (var t = 0; t < 4000; t++) {
      var pick = shuffle(all.slice(), rand).slice(0, want);
      given = [];
      for (i = 0; i < tot; i++) given.push(false);
      pick.forEach(function (k) { given[k] = true; });
      var baseEmpty = 0;
      for (i = 0; i < n; i++) if (!given[i]) baseEmpty++;
      if (baseEmpty < gaps) continue;
      if (!uniquelySolvable(n, given)) continue;
      if (p.prop && !propagate(n, given)) continue;
      return given;
    }
    return null;
  }

  // Eine Mauer. fallback = true, falls eine Regel aufgeweicht werden musste
  // (darf im Selbsttest nie vorkommen).
  function makeWall(rand, p) {
    var n = p.nMin + Math.floor(rand() * (p.nMax - p.nMin + 1));
    for (var a = 0; a < 20; a++) {
      var v = sampleBase(rand, n, p, p.minTop);
      if (!v) continue;
      var given = pickGivens(rand, n, p);
      if (given) return { n: n, vals: v, given: given, fallback: false };
    }
    // Rückfall: kleinste Spitze, nur die Grundreihe vorgegeben.
    var vf = sampleBase(rand, n, p, feasMin(n, p.op)) || values(fill(n, 1), p.op);
    var gf = [];
    for (var i = 0; i < total(n); i++) gf.push(i < n);
    return { n: n, vals: vf, given: gf, fallback: true };
  }
  function fill(n, x) { var a = []; for (var i = 0; i < n; i++) a.push(x); return a; }

  function build(st, rng) {
    var p = params(st), rand = rng(st.seed), walls = [];
    for (var w = 0; w < p.count; w++) walls.push(makeWall(rand, p));
    return { p: p, walls: walls };
  }

  // ---------- Blatt zeichnen ----------

  // Vorgaben leicht grün getönt (im S/W-Druck hellgrau), Lösungen wie beim
  // Suchsel gelb hinterlegt; die Lösungszahl ist dunkel und schräg, damit sie
  // auch ohne Farbe von den Vorgaben zu unterscheiden ist.
  var GIVEN_FILL = "#E4EEE7", SOLVED_FILL = "#FFE9A6", SOLVED = "#6B4A00";

  // Nur Zeichen, die Helvetica im PDF kennt (WinAnsi).
  var WIN_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ" +
    "‘’“”•–—˜™š›œžŸ";
  function winAnsi(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN_EXTRA.indexOf(s[i]) >= 0) out += s[i];
    }
    return out;
  }

  function drawPage(S, st, sheet, solution) {
    var p = new S.Page(), mul = sheet.p.op === "mul";
    var tx = T();
    var title = winAnsi(st.title || "").trim() || (mul ? tx.titleMul : tx.titlePlus);
    var top = p.header(title, {
      tag: solution ? tx.tag : "",
      nameLine: st.name, blank: solution,
      instruction: mul ? tx.instrMul : tx.instrPlus
    });

    var walls = sheet.walls, count = walls.length;
    var nMax = walls.reduce(function (m, w) { return Math.max(m, w.n); }, 0);
    var usable = S.W - 2 * S.MARGIN, bottom = S.H - 18, avail = bottom - top;
    var RATIO = 0.62, GAP = 9, GAPX = 14, CAP = 30;

    // Spaltenzahl so wählen, dass die Steine am größten werden.
    var best = null;
    for (var cols = 1; cols <= Math.min(3, count); cols++) {
      var rows = Math.ceil(count / cols);
      var cw = (usable - (cols - 1) * GAPX) / cols, ch = (avail - (rows - 1) * GAP) / rows;
      var bw = Math.min(cw / nMax, ch / (nMax * RATIO), CAP);
      if (!best || bw > best.bw + 0.01) best = { cols: cols, rows: rows, bw: bw, cw: cw, ch: ch };
    }
    var bw = best.bw, bh = bw * RATIO;
    var pitchY = avail / best.rows, pitchX = (usable + GAPX) / best.cols;

    var digits = 1;
    walls.forEach(function (w) { w.vals.forEach(function (x) { digits = Math.max(digits, String(x).length); }); });
    var fsmm = Math.min(bh * 0.48, bw * 0.78 / (digits * 0.58), 6.6);
    var fs = fsmm / S.PT;

    walls.forEach(function (w, k) {
      var col = k % best.cols, row = Math.floor(k / best.cols);
      // Letzte Zeile mit weniger Mauern mittig.
      var inRow = Math.min(best.cols, count - row * best.cols);
      var rowX0 = S.MARGIN + (usable + GAPX - inRow * pitchX) / 2;
      var cx = rowX0 + (col + 0.5) * pitchX;
      var wallW = w.n * bw, wallH = w.n * bh;
      var x0 = cx - wallW / 2, yBase = top + row * pitchY + (pitchY + wallH) / 2;
      // Boden unter der Mauer: gibt ihr Halt, kostet kaum Druckfarbe.
      p.line(x0 - 2, yBase + 1.3, x0 + wallW + 2, yBase + 1.3, { width: 0.7, color: S.LINE, round: true });
      for (var r = 0; r < w.n; r++) {
        for (var i = 0; i < w.n - r; i++) {
          var id = idx(w.n, r, i), g = w.given[id];
          var x = x0 + (r / 2 + i) * bw, y = yBase - (r + 1) * bh;
          p.rect(x, y, bw, bh, { fill: g ? GIVEN_FILL : solution ? SOLVED_FILL : "#FFFFFF",
            stroke: S.INK, width: 0.45, radius: Math.min(1, bh * 0.08) });
          if (g || solution) {
            p.text(x + bw / 2, y + bh / 2 + fsmm * 0.36, String(w.vals[id]), {
              size: fs, align: "center", color: g ? S.INK : SOLVED, bold: g, italic: !g });
          }
        }
      }
      // Nummer in der freien Ecke links oben, damit man auf „Mauer 3“ zeigen kann.
      var nr = 3.2, nx = x0 + nr + 0.6, ny = yBase - wallH + nr + 0.6;
      p.rect(nx - nr, ny - nr, 2 * nr, 2 * nr, { stroke: S.LINE, width: 0.35, radius: nr });
      p.text(nx, ny + 1.3, String(k + 1), { size: 10, bold: true, align: "center", color: S.SOFT });
    });
    p.footer();
    return p;
  }

  return {
    LEVELS: LEVELS, LEVEL_ORDER: LEVEL_ORDER, ZR_OPTIONS: ZR_OPTIONS, COUNTS: COUNTS,
    MIN_N: MIN_N, MAX_N: MAX_N, MAX_N_MUL: MAX_N_MUL,
    idx: idx, total: total, relations: relations, coeff: coeff, values: values,
    rank: rank, propagate: propagate, uniquelySolvable: uniquelySolvable,
    params: params, build: build, drawPage: drawPage, winAnsi: winAnsi,
    setLang: setLang, lang: function () { return lang; }
  };
});
