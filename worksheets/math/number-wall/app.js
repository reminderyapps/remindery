/* Zahlenmauer-Generator (/worksheets/math/number-wall/). Läuft komplett im
   Browser: Logik in wall.js (auch von selftest.js in Node geprüft), Vorschau
   als SVG, PDF über Sheet.toPDF. Der Zustand steht im Link (#...), damit ein
   geteilter Link genau diese Mauern wieder erzeugt. */
(function () {
  "use strict";

  var S = window.Sheet, NW = window.NumberWall;

  var HINTS = {
    starter: "3 Grundsteine, Zahlen bis 10, nur die oberen Steine sind leer.",
    grade1: "4 Grundsteine, Zahlen bis 20, die unterste Reihe ist vorgegeben.",
    grade2: "4 Grundsteine, bis 100. Auch unten fehlen Zahlen – rückwärts rechnen.",
    pro: "4 Grundsteine, bis 1000, nur so viele Vorgaben wie nötig.",
    master: "5 Grundsteine, bis 1000, nur 5 Vorgaben, unten mindestens 2 Lücken.",
    crazy: "6 bis 7 Grundsteine, bis 10.000, minimale Vorgaben – manchmal hilft nur Knobeln."
  };
  var HINTS_MUL = {
    starter: "3 Grundsteine, Ergebnisse bis 20, nur die oberen Steine sind leer.",
    grade1: "3 Grundsteine, Ergebnisse bis 50, die unterste Reihe ist vorgegeben.",
    grade2: "3 Grundsteine, bis 100. Auch unten fehlen Zahlen – teilen.",
    pro: "4 Grundsteine, bis 1000, 5 Vorgaben, auch unten Lücken.",
    master: "4 Grundsteine, bis 1000, nur 4 Vorgaben, unten mindestens 2 Lücken.",
    crazy: "4 Grundsteine, bis 5000, nur 4 Vorgaben – manchmal hilft nur Knobeln."
  };
  var TITLES = { plus: "Zahlenmauern", mul: "Malmauern" };

  var DEFAULT = { level: "grade2", op: "plus", count: 4, base: 0, zr: 0,
    title: TITLES.plus, solution: true, name: true, seed: 0 };

  var state, sheet, view = "puzzle", timer;
  var $ = function (id) { return document.getElementById(id); };
  var each = function (sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); };

  // ---------- Formular <-> Zustand <-> Link ----------

  function radio(name) { var el = document.querySelector("input[name=" + name + "]:checked"); return el ? el.value : ""; }
  function setRadio(name, v) { var el = document.querySelector("input[name=" + name + "][value='" + v + "']"); if (el) el.checked = true; }

  function readForm() {
    return {
      level: radio("level") || DEFAULT.level, op: radio("op") === "mul" ? "mul" : "plus",
      count: +radio("count") || DEFAULT.count, base: +$("base").value || 0, zr: +$("zr").value || 0,
      title: $("title").value, solution: $("opt-solution").checked, name: $("opt-name").checked,
      seed: state.seed
    };
  }

  function writeForm(st) {
    setRadio("level", st.level); setRadio("op", st.op); setRadio("count", st.count);
    $("base").value = String(st.base); $("zr").value = String(st.zr);
    $("title").value = st.title;
    $("opt-solution").checked = st.solution; $("opt-name").checked = st.name;
  }

  function clean(st) {
    if (!NW.LEVELS[st.level]) st.level = DEFAULT.level;
    if (NW.COUNTS.indexOf(st.count) < 0) st.count = DEFAULT.count;
    if (!(st.base >= NW.MIN_N && st.base <= NW.MAX_N)) st.base = 0;
    if (NW.ZR_OPTIONS.indexOf(st.zr) < 0) st.zr = 0;
    return st;
  }

  function toHash(st) {
    var q = new URLSearchParams();
    q.set("l", st.level); q.set("r", st.op === "mul" ? "m" : "p"); q.set("a", st.count);
    if (st.base) q.set("b", st.base);
    if (st.zr) q.set("z", st.zr);
    q.set("t", st.title);
    q.set("o", (st.solution ? "" : "S") + (st.name ? "" : "N"));
    q.set("s", st.seed);
    return "#" + q.toString();
  }

  function fromHash(hash) {
    if (!hash || hash.length < 3) return null;
    try {
      var q = new URLSearchParams(hash.slice(1));
      if (!q.has("l")) return null;
      var o = q.get("o") || "", op = q.get("r") === "m" ? "mul" : "plus";
      return clean({
        level: q.get("l"), op: op, count: parseInt(q.get("a"), 10) || DEFAULT.count,
        base: parseInt(q.get("b"), 10) || 0, zr: parseInt(q.get("z"), 10) || 0,
        title: q.has("t") ? q.get("t") : TITLES[op],
        solution: o.indexOf("S") < 0, name: o.indexOf("N") < 0,
        seed: parseInt(q.get("s"), 10) || S.newSeed()
      });
    } catch (e) { return null; }
  }

  // ---------- Ablauf ----------

  function render() {
    sheet = NW.build(state, S.rng);
    $("sheet").innerHTML = S.toSVG(NW.drawPage(S, state, sheet, view === "solution"));
    var p = sheet.p, nText = p.nMin === p.nMax ? p.nMin : p.nMin + " bis " + p.nMax;
    $("sheet").setAttribute("aria-label", (view === "solution" ? "Lösung" : "Vorschau") + " mit " +
      sheet.walls.length + " " + (state.op === "mul" ? "Malmauern" : "Zahlenmauern"));
    $("level-hint").textContent = (state.op === "mul" ? HINTS_MUL : HINTS)[state.level] +
      (state.base || state.zr ? " Feineinstellung aktiv, siehe Vorschau." : "");
    var st = $("status");
    st.textContent = sheet.walls.length + " Mauern · " + nText + " Grundsteine · Zahlen bis " +
      (p.zr >= 10000 ? p.zr.toLocaleString("de-DE") : p.zr) + (p.notes.length ? " · " + p.notes.join(", ") : "");
    st.className = p.notes.length ? "status warn" : "status";
    // Malmauern: höchstens 4 Grundsteine.
    each("#base option", function (o) { o.disabled = state.op === "mul" && +o.value > NW.MAX_N_MUL; });
    try { history.replaceState(null, "", toHash(state)); } catch (e) { /* file:// o. ä. */ }
  }

  function changed(e) {
    var prevOp = state.op;
    // Schnellwahl Stufe setzt die Feineinstellung zurück.
    if (e && e.target && e.target.name === "level") { $("base").value = "0"; $("zr").value = "0"; }
    state = readForm();
    // Überschrift folgt der Rechenart, solange sie nicht selbst geändert wurde.
    if (state.op !== prevOp && state.title === TITLES[prevOp]) { state.title = TITLES[state.op]; $("title").value = state.title; }
    clearTimeout(timer);
    timer = setTimeout(render, 80);
  }

  function setView(v) {
    view = v;
    each("[data-view]", function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === v)); });
    render();
  }

  function toast(msg) {
    $("toast").textContent = msg;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { $("toast").textContent = ""; }, 3500);
  }

  function slug(s) {
    return (s || "zahlenmauern").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
      .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "zahlenmauern";
  }

  function init() {
    state = fromHash(location.hash) || Object.assign({}, DEFAULT, { seed: S.newSeed() });
    writeForm(state);

    document.querySelector(".tool").addEventListener("input", changed);
    document.querySelector(".tool").addEventListener("change", changed);
    each("[data-view]", function (b) { b.addEventListener("click", function () { setView(b.dataset.view); }); });

    $("shuffle").addEventListener("click", function () {
      state = readForm(); state.seed = S.newSeed(); render();
    });
    $("pdf").addEventListener("click", function () {
      var pages = [NW.drawPage(S, state, sheet, false)];
      if (state.solution) pages.push(NW.drawPage(S, state, sheet, true));
      var title = state.title.trim() || TITLES[state.op];
      S.toPDF(pages, slug(title) + ".pdf", NW.winAnsi(title));
      toast(state.solution ? "PDF mit Lösungsblatt erstellt." : "PDF erstellt.");
    });
    $("share").addEventListener("click", function () {
      var url = location.href.split("#")[0] + toHash(state);
      var done = function () { toast("Link kopiert – er erzeugt genau diese Mauern."); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt("Link kopieren:", url); });
      } else { window.prompt("Link kopieren:", url); }
    });

    // Geteilten Link in einen schon offenen Tab einfügen: Blatt neu aufbauen.
    window.addEventListener("hashchange", function () {
      var st = fromHash(location.hash);
      if (st) { state = st; writeForm(state); render(); }
    });
    // ?view=solution öffnet direkt die Lösungsansicht (wie beim Suchsel).
    if (new URLSearchParams(location.search).get("view") === "solution") setView("solution");
    else render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
