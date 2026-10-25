/* Suchsel-Generator (Seiten /lernmaterial/suchsel-generator/ und
   /en/worksheets/word-search-generator/, Texte je Sprache in STR). Läuft komplett im Browser:
   Wörter verstecken, Vorschau als SVG, PDF über Sheet.toPDF. Der Zustand steht
   im Link (#...), damit ein geteilter Link genau dieses Suchsel wieder erzeugt. */
(function () {
  "use strict";

  var S = window.Sheet;
  var EN = S.lang === "en";

  // Alle sichtbaren Texte je Sprache (<html lang>, über Sheet.lang).
  var STR = {
    de: {
      titlePrefix: "Suchsel: ", title: "Suchsel", tag: "Lösung",
      find: "Finde die versteckten Wörter und kreise sie ein.",
      findN: function (n) { return "Finde " + n + " versteckte Wörter und kreise sie ein."; },
      listHead: "Diese Wörter sind versteckt", listHeadSol: "Versteckte Wörter",
      words: function (n) { return n + (n === 1 ? " Wort" : " Wörter"); },
      solution: "Lösung", preview: "Vorschau",
      aria: function (n) { return " des Suchsels mit " + n + " Wörtern"; },
      empty: "Gib mindestens ein Wort ein.",
      noRoom: function (w) { return "Kein Platz für: " + w + ". Gitter größer machen oder mehr Richtungen erlauben."; },
      hidden: function (n) { return n + (n === 1 ? " Wort" : " Wörter") + " versteckt"; },
      max: function (m) { return " (höchstens " + m + ")"; },
      sheetNo: " · Blatt ", sheets: " Blätter",
      madeSol: " mit Lösungen erstellt.", made: " erstellt.",
      copied: "Link kopiert – er erzeugt genau dieses Suchsel.", copyPrompt: "Link kopieren:",
      file: "suchsel"
    },
    en: {
      titlePrefix: "Word Search: ", title: "Word Search", tag: "Answer key",
      find: "Find the hidden words and circle them.",
      findN: function (n) { return "Find " + n + " hidden words and circle them."; },
      listHead: "Words to find", listHeadSol: "Hidden words",
      words: function (n) { return n + (n === 1 ? " word" : " words"); },
      solution: "Answer key", preview: "Preview",
      aria: function (n) { return " of the word search with " + n + " words"; },
      empty: "Enter at least one word.",
      noRoom: function (w) { return "No room for: " + w + ". Make the grid bigger or allow more directions."; },
      hidden: function (n) { return n + (n === 1 ? " word" : " words") + " hidden"; },
      max: function (m) { return " (max. " + m + ")"; },
      sheetNo: " · Sheet ", sheets: " sheets",
      madeSol: " with answer keys created.", made: " created.",
      copied: "Link copied – it recreates exactly this word search.", copyPrompt: "Copy link:",
      file: "word-search"
    }
  };
  var T = EN ? STR.en : STR.de;

  // Richtungen: Kennung, Schritt, Pfeil fürs Formular.
  var DIRS = {
    E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1],
    SE: [1, 1], NW: [-1, -1], NE: [1, -1], SW: [-1, 1]
  };
  var PRESETS = {
    easy: ["E", "S"],
    medium: ["E", "S", "SE"],
    hard: ["E", "W", "S", "N", "SE", "NW", "NE", "SW"]
  };

  var THEMES_DE = {
    herbst: ["Herbst", "Apfel, Blatt, Igel, Kürbis, Drachen, Regen, Pilz, Nebel, Kastanie, Wind, Eichel, Laterne"],
    tiere: ["Tiere", "Hund, Katze, Maus, Pferd, Kuh, Schaf, Ziege, Hase, Fuchs, Eule, Frosch, Igel"],
    schule: ["Schule", "Heft, Stift, Lineal, Tafel, Kreide, Pause, Ranzen, Buch, Kleber, Schere, Lehrer, Klasse"],
    farben: ["Farben", "Rot, Blau, Gelb, Grün, Lila, Rosa, Weiß, Braun, Grau, Orange, Schwarz, Bunt"],
    winter: ["Winter", "Schnee, Eis, Mütze, Schal, Schlitten, Kälte, Flocke, Frost, Handschuh, Ofen, Iglu, Pinguin"],
    // Weihnachten und Advent: auch Wortlisten der fertigen Themen-Blätter
    // (/lernmaterial/suchsel-weihnachten/, /suchsel-advent/, tool/worksheets/build_themes.mjs).
    weihnachten: ["Weihnachten", "Stern, Kerze, Engel, Geschenk, Tannenbaum, Glocke, Krippe, Schlitten, Rentier, Christkind, Lametta, Kugel, Hirte, Esel, Stall, Plätzchen"],
    advent: ["Advent", "Kerze, Kranz, Kalender, Türchen, Nikolaus, Stiefel, Plätzchen, Backen, Nüsse, Mandarine, Zimt, Tanne, Lebkuchen, Wunschzettel, Lichterkette, Advent"],
    koerper: ["Mein Körper", "Kopf, Hand, Fuß, Arm, Bein, Nase, Mund, Ohr, Auge, Bauch, Knie, Zahn"],
    obst: ["Obst und Gemüse", "Apfel, Birne, Banane, Kirsche, Traube, Möhre, Gurke, Tomate, Paprika, Erbse, Melone, Pflaume"]
  };

  // Füllbuchstaben: deutsche Buchstabenhäufigkeit, abgeflacht (Wurzel), damit
  // das Gitter natürlich aussieht, aber nicht nur aus E und N besteht.
  var FREQ_DE = { A: 6.5, B: 1.9, C: 3.1, D: 5.1, E: 17.4, F: 1.7, G: 3, H: 4.8, I: 7.6, J: 0.3,
    K: 1.2, L: 3.4, M: 2.5, N: 9.8, O: 2.5, P: 0.8, Q: 0.1, R: 7, S: 7.3, T: 6.2, U: 4.4,
    V: 0.7, W: 1.9, X: 0.1, Y: 0.1, Z: 1.1 };

  // Englisch: Themen für 5- bis 9-Jährige, Wörter ohne britisch/amerikanische
  // Schreibvarianten (kein colour/color, grey/gray, sledge/sled).
  var THEMES_EN = {
    animals: ["Animals", "Dog, Cat, Mouse, Horse, Cow, Sheep, Goat, Rabbit, Fox, Owl, Frog, Duck"],
    autumn: ["Autumn", "Apple, Leaf, Acorn, Pumpkin, Owl, Rain, Wind, Hedgehog, Squirrel, Mushroom, Scarecrow, Harvest"],
    winter: ["Winter", "Snow, Ice, Hat, Scarf, Snowman, Mittens, Frost, Cold, Boots, Igloo, Penguin, Snowflake"],
    christmas: ["Christmas", "Star, Candle, Angel, Gift, Tree, Bell, Reindeer, Sleigh, Stocking, Elf, Wreath, Holly"],
    ocean: ["Under the Sea", "Fish, Shark, Whale, Crab, Shell, Wave, Starfish, Octopus, Dolphin, Seal, Sand, Boat"],
    food: ["Healthy Food", "Apple, Pear, Banana, Cherry, Orange, Carrot, Tomato, Pea, Melon, Plum, Lemon, Potato"],
    school: ["School", "Pencil, Book, Ruler, Desk, Paper, Glue, Scissors, Teacher, Crayon, Chair, Lunch, Map"],
    body: ["My Body", "Head, Hand, Foot, Arm, Leg, Nose, Mouth, Ear, Eye, Knee, Tooth, Finger"]
  };
  // Englische Buchstabenhäufigkeit, abgeflacht wie oben.
  var FREQ_EN = { A: 8.2, B: 1.5, C: 2.8, D: 4.3, E: 12.7, F: 2.2, G: 2, H: 6.1, I: 7, J: 0.15,
    K: 0.8, L: 4, M: 2.4, N: 6.7, O: 7.5, P: 1.9, Q: 0.1, R: 6, S: 6.3, T: 9.1, U: 2.8,
    V: 1, W: 2.4, X: 0.15, Y: 2, Z: 0.1 };

  var MAX_WORDS = 40,MIN_SIZE = 5, MAX_SIZE = 25;
  var THEMES = EN ? THEMES_EN : THEMES_DE, FREQ = EN ? FREQ_EN : FREQ_DE;
  var DEFAULT_THEME = EN ? THEMES.animals : THEMES.herbst;

  var DEFAULT = {
    title: T.titlePrefix + DEFAULT_THEME[0], words: DEFAULT_THEME[1].split(", ").join("\n"),
    cols: 12, rows: 12, dirs: PRESETS.medium.slice(), letters: "upper", umlauts: "keep",
    fill: "random", list: true, solution: true, name: true, lines: true, pages: 1, listSize: 12, seed: 0
  };

  var state;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Wörter ----------

  // „behalten“: Ä Ö Ü und ß sind je ein Feld (ß bleibt ß, auch im Großdruck –
  // ein großes ẞ kennt die PDF-Schrift nicht). „ausschreiben“: AE OE UE SS.
  // Englisch: Buchstaben allgemein behandeln – A–Z und jeder andere Buchstabe,
  // den die PDF-Schrift kennt (é, ñ, ø …), ist ein Feld; ß bleibt ein Feld.
  // Ein alter Link mit „ausschreiben“ wirkt auch hier.
  function normalizeEn(word, umlauts) {
    if (umlauts === "expand") word = word.replace(/ä/gi, "ae").replace(/ö/gi, "oe").replace(/ü/gi, "ue").replace(/ß/g, "ss");
    var w = word.replace(/ß/g, "\u0000").toLocaleUpperCase("en").replace(/\u0000/g, "ß");
    return S.winAnsi(w).replace(/[^A-Z\u00C0-\u00D6\u00D8-\u00DF\u0152\u0160\u017D\u0178]/g, "");
  }

  function normalize(word, umlauts) {
    if (EN) return normalizeEn(word, umlauts);
    var w = word.replace(/ß/g, umlauts === "expand" ? "ss" : "\u0000").toLocaleUpperCase("de-DE");
    if (umlauts === "expand") w = w.replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE");
    return w.replace(/\u0000/g, "ß").replace(/[^A-ZÄÖÜß]/g, "");
  }

  // Wörter, die beim zufälligen Auffüllen nicht entstehen dürfen (in allen
  // acht Richtungen geprüft, nur in Füllbuchstaben-Bereichen relevant).
  var BAD_DE = ["ARSCH", "FICK", "SEX", "NAZI", "HITLER", "KACK", "PENIS", "SCHEISS", "HURE", "TOD", "WICHS", "NUTTE"];
  var BAD_EN = ["FUCK", "FUK", "SHIT", "CUNT", "DICK", "COCK", "PISS", "ARSE", "ASS", "SEX", "PORN", "SLUT",
    "WHORE", "TIT", "BITCH", "BOOB", "FAG", "NIGG", "RAPE", "KILL", "NAZI", "HITLER", "PENIS", "CRAP", "DAMN"];
  var BAD = EN ? BAD_EN : BAD_DE;

  function hasBad(letters, cols, rows) {
    var lines = [], x, y;
    for (y = 0; y < rows; y++) { var r = ""; for (x = 0; x < cols; x++) r += letters[y * cols + x]; lines.push(r); }
    for (x = 0; x < cols; x++) { var c = ""; for (y = 0; y < rows; y++) c += letters[y * cols + x]; lines.push(c); }
    for (var k = -rows; k < cols; k++) {
      var d1 = "", d2 = "";
      for (y = 0; y < rows; y++) {
        x = k + y; if (x >= 0 && x < cols) d1 += letters[y * cols + x];
        x = cols - 1 - (k + y); if (x >= 0 && x < cols) d2 += letters[y * cols + x];
      }
      lines.push(d1, d2);
    }
    var all = lines.join("|"), rev = all.split("").reverse().join("");
    return BAD.some(function (b) { return all.indexOf(b) >= 0 || rev.indexOf(b) >= 0; });
  }

  function parseWords(raw, umlauts) {
    var seen = {}, out = [];
    raw.split(/[\n,;]+/).forEach(function (part) {
      var label = part.trim().replace(/\s+/g, " ");
      if (!label) return;
      var key = normalize(label, umlauts);
      if (key.length < 2 || seen[key]) return;
      seen[key] = true;
      out.push({ label: label, key: key });
    });
    return out.slice(0, MAX_WORDS);
  }

  // ---------- Verstecken ----------

  function attempt(words, cols, rows, dirs, rand) {
    var grid = new Array(cols * rows).fill(null);
    var placed = [], missing = [];
    words.forEach(function (w) {
      var L = w.key.length, cands = [], total = 0;
      dirs.forEach(function (d) {
        var dx = DIRS[d][0], dy = DIRS[d][1];
        for (var y = 0; y < rows; y++) {
          var ey = y + dy * (L - 1);
          if (ey < 0 || ey >= rows) continue;
          for (var x = 0; x < cols; x++) {
            var ex = x + dx * (L - 1);
            if (ex < 0 || ex >= cols) continue;
            var ov = 0, ok = true;
            for (var i = 0; i < L; i++) {
              var c = grid[(y + dy * i) * cols + x + dx * i];
              if (c === null) continue;
              if (c !== w.key[i]) { ok = false; break; }
              ov++;
            }
            // Ein Wort darf nicht vollständig in einem anderen liegen.
            if (!ok || ov === L) continue;
            var weight = 1 + ov * 2;
            cands.push({ x: x, y: y, dx: dx, dy: dy, w: weight });
            total += weight;
          }
        }
      });
      if (!cands.length) { missing.push(w); return; }
      var r = rand() * total, pick = cands[cands.length - 1];
      for (var k = 0; k < cands.length; k++) { r -= cands[k].w; if (r <= 0) { pick = cands[k]; break; } }
      for (var j = 0; j < L; j++) grid[(pick.y + pick.dy * j) * cols + pick.x + pick.dx * j] = w.key[j];
      placed.push({ word: w, x: pick.x, y: pick.y, dx: pick.dx, dy: pick.dy });
    });
    return { grid: grid, placed: placed, missing: missing };
  }

  function build(st) {
    var words = parseWords(st.words, st.umlauts);
    var rand = S.rng(st.seed);
    var dirs = st.dirs.length ? st.dirs : ["E"];
    // Lange Wörter zuerst, bei gleicher Länge zufällig.
    var order = words.map(function (w) { return { w: w, r: rand() }; })
      .sort(function (a, b) { return b.w.key.length - a.w.key.length || a.r - b.r; })
      .map(function (o) { return o.w; });
    var best = null;
    for (var t = 0; t < 40; t++) {
      var res = attempt(order, st.cols, st.rows, dirs, rand);
      if (!best || res.missing.length < best.missing.length) best = res;
      if (!best.missing.length) break;
    }
    // Leere Felder füllen.
    var pool = [];
    if (st.fill === "words") {
      words.forEach(function (w) { pool.push.apply(pool, w.key.split("")); });
    }
    if (!pool.length) {
      Object.keys(FREQ).forEach(function (ch) {
        var n = Math.round(Math.sqrt(FREQ[ch]) * 10);
        for (var i = 0; i < n; i++) pool.push(ch);
      });
    }
    var fillOnce = function () {
      return best.grid.map(function (c) { return c === null ? pool[Math.floor(rand() * pool.length)] : c; });
    };
    // Erneut füllen, falls zufällig ein unpassendes Wort entsteht. Steht es in
    // der eigenen Wortliste, ist das gewollt – dann nicht endlos würfeln.
    var letters = fillOnce();
    for (var f = 0; f < 25 && hasBad(letters, st.cols, st.rows); f++) letters = fillOnce();
    // Liste in der Reihenfolge der Eingabe, nur was im Gitter steht.
    var placedKeys = {};
    best.placed.forEach(function (p) { placedKeys[p.word.key] = true; });
    return {
      letters: letters, placed: best.placed, missing: best.missing,
      list: words.filter(function (w) { return placedKeys[w.key]; }), total: words.length
    };
  }

  // ---------- Blatt zeichnen ----------

  function shown(ch, st) { return st.letters === "lower" ? ch.toLocaleLowerCase(EN ? "en" : "de-DE") : ch; }
  function listLabel(w, st) {
    if (st.letters !== "upper") return w.label;
    if (EN) return w.label.replace(/ß/g, "\u0000").toLocaleUpperCase("en").replace(/\u0000/g, "ß");
    var keepSz = st.umlauts !== "expand";
    return w.label.replace(/ß/g, keepSz ? "\u0000" : "ß").toLocaleUpperCase("de-DE").replace(/\u0000/g, "ß");
  }

  function drawPage(st, puz, solution) {
    var p = new S.Page();
    var top = p.header(st.title.trim() || T.title, {
      tag: solution ? T.tag : "",
      nameLine: st.name, blank: solution,
      instruction: (st.list ? T.find : T.findN(puz.list.length))
    });

    // Wortliste vorab vermessen (ca. 0,55 × Schriftgröße je Zeichen). Die
    // Schriftgröße stellt der Regler „Gitter ⟷ Wörter“ ein (8–16 pt); kleinere
    // Schrift = mehr Spalten, weniger Zeilen, mehr Platz fürs Gitter.
    var listSize = st.listSize || 12, lineH = listSize * 0.633, items = puz.list.map(function (w) { return listLabel(w, st); });
    var longest = items.reduce(function (m, s) { return Math.max(m, s.length); }, 0);
    var colW = longest * listSize * S.PT * 0.62 + 10;
    var usable = S.W - 2 * S.MARGIN;
    var ncol = Math.max(1, Math.min(6, Math.floor((usable - 10) / colW)));
    var nline = Math.ceil(items.length / ncol);
    var listH = st.list && items.length ? 14 + nline * lineH : 0;

    var bottom = S.H - 20 - (listH ? listH + 8 : 0);
    var cell = Math.min(usable / st.cols, (bottom - top) / st.rows, 15);
    var gw = cell * st.cols, gh = cell * st.rows;
    var gx = (S.W - gw) / 2, gy = top + 2;

    // Lösung: Markierung unter den Buchstaben. Erst alle Ränder, dann alle
    // Füllungen – so verschmelzen sich kreuzende Wörter sauber, und der Rand
    // bleibt auch im Schwarz-Weiß-Druck sichtbar.
    if (solution) {
      [["#E3AE2C", 0.74 + 0.7 / cell], ["#FFE08A", 0.74 - 0.7 / cell]].forEach(function (layer) {
        puz.placed.forEach(function (pl) {
          var L = pl.word.key.length - 1;
          p.line(gx + (pl.x + 0.5) * cell, gy + (pl.y + 0.5) * cell,
            gx + (pl.x + pl.dx * L + 0.5) * cell, gy + (pl.y + pl.dy * L + 0.5) * cell,
            { width: cell * layer[1], color: layer[0], round: true });
        });
      });
    }
    if (st.lines) {
      for (var i = 1; i < st.cols; i++) p.line(gx + i * cell, gy, gx + i * cell, gy + gh, { width: 0.18, color: S.LINE });
      for (var j = 1; j < st.rows; j++) p.line(gx, gy + j * cell, gx + gw, gy + j * cell, { width: 0.18, color: S.LINE });
    }
    p.rect(gx, gy, gw, gh, { stroke: S.INK, width: 0.6, radius: Math.min(3, cell * 0.3) });

    var fs = cell * 0.58 / S.PT;
    for (var y = 0; y < st.rows; y++) {
      for (var x = 0; x < st.cols; x++) {
        p.text(gx + (x + 0.5) * cell, gy + (y + 0.5) * cell + cell * 0.58 * 0.36,
          shown(puz.letters[y * st.cols + x], st), { size: fs, align: "center" });
      }
    }

    if (listH) {
      // Wortliste in einem fein gerahmten Kasten, Kopfzeile mit Anzahl.
      var by = gy + gh + 8, bh = listH;
      p.rect(S.MARGIN, by, usable, bh, { stroke: S.LINE, width: 0.35, radius: 3 });
      var ly = by + 8;
      p.text(S.MARGIN + 5, ly, solution ? T.listHeadSol : T.listHead, { size: 11, bold: true });
      p.text(S.W - S.MARGIN - 5, ly, T.words(items.length),
        { size: 10, align: "right", color: S.SOFT });
      ly += 8.5;
      var cw = (usable - 10) / ncol;
      items.forEach(function (s, k) {
        var cx = S.MARGIN + 5 + Math.floor(k / nline) * cw, cy = ly + (k % nline) * lineH;
        var k4 = listSize / 12; // Kästchen wächst mit der Schrift
        p.rect(cx, cy - 3.5 * k4, 4 * k4, 4 * k4, { stroke: S.SOFT, width: 0.35, radius: 0.8 });
        if (solution) {
          p.line(cx + 0.9 * k4, cy - 1.6 * k4, cx + 1.8 * k4, cy - 0.6 * k4, { width: 0.5, round: true });
          p.line(cx + 1.8 * k4, cy - 0.6 * k4, cx + 3.3 * k4, cy - 2.9 * k4, { width: 0.5, round: true });
        }
        p.text(cx + 6.5 * k4, cy, s, { size: listSize });
      });
    }
    p.footer();
    return p;
  }

  // ---------- Formular <-> Zustand <-> Link ----------

  function clampSize(v) {
    v = parseInt(v, 10);
    return isNaN(v) ? 12 : Math.max(MIN_SIZE, Math.min(MAX_SIZE, v));
  }

  function readForm() {
    var dirs = [];
    Array.prototype.forEach.call(document.querySelectorAll(".dirs input:checked"), function (el) { dirs.push(el.value); });
    return {
      title: $("title").value, words: $("words").value,
      cols: clampSize($("cols").value), rows: clampSize($("rows").value), dirs: dirs,
      letters: document.querySelector("input[name=letters]:checked").value,
      // Englische Seite hat keine Umlaut-Wahl: Wert aus dem Link bleibt erhalten.
      umlauts: (document.querySelector("input[name=umlauts]:checked") || { value: (state && state.umlauts) || "keep" }).value,
      fill: document.querySelector("input[name=fill]:checked").value,
      list: $("opt-list").checked, solution: $("opt-solution").checked,
      name: $("opt-name").checked, lines: $("opt-lines").checked,
      pages: +((document.querySelector("input[name=pages]:checked") || {}).value) || 1,
      listSize: +$("list-size").value || 12, seed: state.seed
    };
  }

  function writeForm(st) {
    $("title").value = st.title; $("words").value = st.words;
    $("cols").value = st.cols; $("rows").value = st.rows;
    Array.prototype.forEach.call(document.querySelectorAll(".dirs input"), function (el) {
      el.checked = st.dirs.indexOf(el.value) >= 0;
    });
    ["letters", "umlauts", "fill"].forEach(function (n) {
      var el = document.querySelector("input[name=" + n + "][value=" + st[n] + "]");
      if (el) el.checked = true;
    });
    $("opt-list").checked = st.list; $("opt-solution").checked = st.solution;
    $("opt-name").checked = st.name; $("opt-lines").checked = st.lines;
    var pg = document.querySelector("input[name=pages][value='" + (st.pages || 1) + "']");
    if (pg) pg.checked = true;
    $("list-size").value = st.listSize || 12;
  }

  function toHash(st) {
    var q = new URLSearchParams();
    q.set("t", st.title);
    q.set("w", parseWords(st.words, "keep").map(function (w) { return w.label; }).join(","));
    q.set("g", st.cols + "x" + st.rows);
    q.set("d", st.dirs.join("."));
    q.set("o", [st.letters === "lower" ? "k" : "", st.umlauts === "expand" ? "u" : "",
      st.fill === "words" ? "f" : "", st.list ? "" : "L", st.solution ? "" : "S",
      st.name ? "" : "N", st.lines ? "" : "G"].join(""));
    if (st.pages > 1) q.set("p", st.pages);
    if (st.listSize && st.listSize !== 12) q.set("ls", st.listSize);
    q.set("s", st.seed);
    return "#" + q.toString();
  }

  function fromHash(hash) {
    if (!hash || hash.length < 3) return null;
    try {
      var q = new URLSearchParams(hash.slice(1));
      if (!q.has("w")) return null;
      var g = (q.get("g") || "12x12").split("x"), o = q.get("o") || "";
      var dirs = (q.get("d") || "").split(".").filter(function (d) { return DIRS[d]; });
      return {
        title: q.get("t") || "", words: q.get("w").split(",").join("\n"),
        cols: clampSize(g[0]), rows: clampSize(g[1]), dirs: dirs.length ? dirs : PRESETS.medium.slice(),
        letters: o.indexOf("k") >= 0 ? "lower" : "upper", umlauts: o.indexOf("u") >= 0 ? "expand" : "keep",
        fill: o.indexOf("f") >= 0 ? "words" : "random", list: o.indexOf("L") < 0,
        solution: o.indexOf("S") < 0, name: o.indexOf("N") < 0, lines: o.indexOf("G") < 0,
        listSize: Math.max(8, Math.min(16, parseInt(q.get("ls"), 10) || 12)),
        pages: [1, 2, 3, 5, 10].indexOf(parseInt(q.get("p"), 10)) >= 0 ? parseInt(q.get("p"), 10) : 1,
        seed: parseInt(q.get("s"), 10) || S.newSeed()
      };
    } catch (e) { return null; }
  }

  // ---------- Ablauf ----------

  var puzzle, view = "puzzle", timer;

  function syncPresets() {
    var cur = state.dirs.slice().sort().join();
    Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (b) {
      b.setAttribute("aria-pressed", String(PRESETS[b.dataset.preset].slice().sort().join() === cur));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-size]"), function (b) {
      var n = +b.dataset.size;
      b.setAttribute("aria-pressed", String(state.cols === n && state.rows === n));
    });
  }

  function render() {
    puzzle = build(state);
    $("sheet").innerHTML = S.toSVG(drawPage(state, puzzle, view === "solution"));
    $("sheet").setAttribute("aria-label", (view === "solution" ? T.solution : T.preview) +
      T.aria(puzzle.list.length));
    var st = $("status");
    if (!puzzle.total) {
      st.textContent = T.empty; st.className = "status warn";
    } else if (puzzle.missing.length) {
      st.textContent = T.noRoom(puzzle.missing.map(function (w) { return w.label; }).join(", "));
      st.className = "status warn";
    } else {
      st.textContent = T.hidden(puzzle.list.length) +
        (parseWords(state.words, state.umlauts).length >= MAX_WORDS ? T.max(MAX_WORDS) : "");
      st.className = "status";
    }
    $("pdf").disabled = !puzzle.list.length;
    syncPresets();
    $("list-size-field").hidden = !state.list;
    try { history.replaceState(null, "", toHash(state)); } catch (e) { /* file:// o. ä. */ }
  }

  function changed() {
    state = readForm();
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  }

  function setView(v) {
    view = v;
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.view === v));
    });
    render();
  }

  function toast(msg) {
    $("toast").textContent = msg;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { $("toast").textContent = ""; }, 3500);
  }

  function slug(s) {
    return (s || T.file).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
      .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || T.file;
  }

  function init() {
    state = fromHash(location.hash) || Object.assign({}, DEFAULT, { seed: S.newSeed() });
    writeForm(state);

    document.querySelector(".tool").addEventListener("input", changed);
    document.querySelector(".tool").addEventListener("change", changed);

    Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (b) {
      b.addEventListener("click", function () {
        var dirs = PRESETS[b.dataset.preset];
        Array.prototype.forEach.call(document.querySelectorAll(".dirs input"), function (el) {
          el.checked = dirs.indexOf(el.value) >= 0;
        });
        changed();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-size]"), function (b) {
      b.addEventListener("click", function () { $("cols").value = $("rows").value = b.dataset.size; changed(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (b) {
      b.addEventListener("click", function () { setView(b.dataset.view); });
    });
    $("theme").addEventListener("change", function () {
      var th = THEMES[this.value];
      if (!th) return;
      $("title").value = T.titlePrefix + th[0];
      $("words").value = th[1].split(", ").join("\n");
      this.value = "";
      changed();
    });
    $("shuffle").addEventListener("click", function () {
      state = readForm(); state.seed = S.newSeed(); render();
    });
    $("pdf").addEventListener("click", function () {
      // Mehrere Blätter: Blatt 1 = Vorschau, jedes weitere neu gemischt.
      // Erst alle Rätsel, dann alle Lösungen.
      var title = state.title.trim() || T.title, puzzles = [], solutions = [];
      for (var i = 0; i < state.pages; i++) {
        var st = Object.assign({}, state, { seed: (state.seed + i * 7919) >>> 0 });
        if (state.pages > 1) st.title = title + T.sheetNo + (i + 1);
        var pz = i ? build(st) : puzzle;
        puzzles.push(drawPage(st, pz, false));
        if (state.solution) solutions.push(drawPage(st, pz, true));
      }
      S.toPDF(puzzles.concat(solutions), slug(state.title) + ".pdf", title);
      toast((state.pages > 1 ? state.pages + T.sheets : "PDF") +
        (state.solution ? T.madeSol : T.made));
    });
    $("share").addEventListener("click", function () {
      var url = location.href.split("#")[0] + toHash(state);
      var done = function () { toast(T.copied); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt(T.copyPrompt, url); });
      } else { window.prompt(T.copyPrompt, url); }
    });

    // Geteilten Link in einen schon offenen Tab einfügen: Blatt neu aufbauen.
    window.addEventListener("hashchange", function () {
      var st = fromHash(location.hash);
      if (st) { state = st; writeForm(state); render(); }
    });
    // ?view=solution öffnet direkt die Lösungsansicht (Link aus dem Lehrerzimmer, Vorschaubilder).
    if (new URLSearchParams(location.search).get("view") === "solution") setView("solution");
    else render();
  }

  // Für den Bau der fertigen Themen-Blätter (tool/worksheets/build_themes.mjs):
  // dieselbe Logik wie die Seite, ohne Formular.
  window.WordSearch = { THEMES: THEMES, PRESETS: PRESETS, build: build, drawPage: drawPage,
    fromHash: fromHash, toHash: toHash };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
