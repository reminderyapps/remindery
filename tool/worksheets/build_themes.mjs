// Builds the ready-made theme worksheets under /lernmaterial/<slug>/:
// three static PDFs (puzzle + answer key) per page and the inline SVG
// previews in the page's <!-- build:sheets --> block.
//
// It drives the real generator code (worksheets/sheet.js, word-search/app.js,
// math/number-wall/wall.js + app.js) in headless Chrome via the DevTools
// protocol, so the PDFs are exactly what the generators produce for the same
// link. Fixed seeds, creation date and file IDs: a rebuild is byte-identical.
//
//   node C:\dev\web\remindery-site\tool\worksheets\build_themes.mjs [--check]
//
// --check: build into memory only and report pages whose PDFs or previews
// would change (exit code 1), nothing is written.
// Needs Node >= 22 (built-in WebSocket) and Chrome (CHROME env var or the
// default install path).

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CHECK = process.argv.includes("--check");
const PDF_DATE = "D:20261025000000+00'00'";

// ---------- Sheet definitions ----------
// hash = exactly the generator link (#...) that recreates the sheet.

const WS = "/lernmaterial/suchsel-generator/";
const NWG = "/lernmaterial/zahlenmauer-generator/";
const EASY = "E.S", MEDIUM = "E.S.SE", HARD = "E.W.S.N.SE.NW.NE.SW";

function ws(title, words, size, dirs, opts, seed) {
  return { t: "Suchsel: " + title, w: words.join(","), g: size + "x" + size, d: dirs, o: opts, s: seed };
}
function nw(title, level, op, count, base, zr, seed) {
  const h = { l: level, r: op, a: count };
  if (base) h.b = base;
  if (zr) h.z = zr;
  return Object.assign(h, { t: title, o: "", s: seed });
}

const WORDS = {
  weihnachten: {
    easy: ["Stern", "Kerze", "Engel", "Kugel", "Esel", "Stall", "Hirte", "Glocke"],
    medium: ["Stern", "Kerze", "Engel", "Geschenk", "Glocke", "Krippe", "Schlitten", "Rentier", "Kugel", "Lametta", "Hirte", "Plätzchen"]
  },
  advent: {
    easy: ["Kerze", "Kranz", "Zimt", "Tanne", "Nüsse", "Backen", "Advent", "Stiefel"],
    medium: ["Kerze", "Kranz", "Kalender", "Türchen", "Nikolaus", "Stiefel", "Plätzchen", "Backen", "Nüsse", "Zimt", "Tanne", "Advent"]
  },
  winter: { easy: ["Schnee", "Eis", "Mütze", "Schal", "Frost", "Ofen", "Iglu", "Flocke"] },
  herbst: { easy: ["Apfel", "Blatt", "Igel", "Pilz", "Regen", "Nebel", "Wind", "Kürbis"] },
  tiere: { easy: ["Hund", "Katze", "Maus", "Kuh", "Schaf", "Hase", "Eule", "Igel"] }
};

// Word lists for "mittel"/"schwer" that are not spelled out above come from the
// generator's THEMES (filled in at build time, see themeWords()).
function suchselPage(slug, theme, title, seeds) {
  const W = WORDS[theme];
  return {
    slug, gen: WS, kind: "ws", theme,
    sheets: [
      { level: "leicht", label: "Leicht", desc: "8 Wörter, 10 × 10 Felder, nur nach rechts und nach unten. Ab Ende Klasse 1.",
        hash: () => ws(title, W.easy, 10, EASY, "", seeds[0]) },
      { level: "mittel", label: "Mittel", desc: "12 Wörter, 12 × 12 Felder, auch schräg nach rechts unten. Für Klasse 2.",
        hash: (all) => ws(title, W.medium || all, 12, MEDIUM, "", seeds[1]) },
      { level: "schwer", label: "Schwer", desc: null,
        hash: (all) => ws(title, all, all.length > 12 ? 15 : 14, HARD, "k", seeds[2]) }
    ]
  };
}

const PAGES = [
  suchselPage("suchsel-weihnachten", "weihnachten", "Weihnachten", [2412, 1224, 2512]),
  suchselPage("suchsel-advent", "advent", "Advent", [1201, 1206, 1213]),
  suchselPage("suchsel-winter", "winter", "Winter", [2101, 2102, 2103]),
  suchselPage("suchsel-herbst", "herbst", "Herbst", [2201, 2202, 2203]),
  suchselPage("suchsel-tiere", "tiere", "Tiere", [2301, 2302, 2303]),
  { slug: "zahlenmauern-klasse-1", gen: NWG, kind: "nw", sheets: [
    { level: "leicht", label: "Leicht", desc: "6 Mauern mit 3 Grundsteinen, Zahlen bis 10. Die unterste Reihe ist vorgegeben.",
      hash: () => nw("Zahlenmauern Klasse 1", "starter", "p", 6, 0, 0, 3101) },
    { level: "mittel", label: "Mittel", desc: "6 Mauern mit 3 Grundsteinen, Zahlen bis 20 – mit Zehnerübergang.",
      hash: () => nw("Zahlenmauern Klasse 1", "grade1", "p", 6, 3, 20, 3102) },
    { level: "schwer", label: "Schwer", desc: "6 Mauern mit 4 Grundsteinen, Zahlen bis 20. Drei Reihen nach oben rechnen.",
      hash: () => nw("Zahlenmauern Klasse 1", "grade1", "p", 6, 0, 0, 3103) }
  ] },
  { slug: "zahlenmauern-klasse-2", gen: NWG, kind: "nw", sheets: [
    { level: "leicht", label: "Leicht", desc: "6 Mauern mit 4 Grundsteinen, Zahlen bis 100. Die unterste Reihe ist vorgegeben.",
      hash: () => nw("Zahlenmauern Klasse 2", "grade1", "p", 6, 0, 100, 3201) },
    { level: "mittel", label: "Mittel", desc: "4 Mauern bis 100, auch unten fehlen Zahlen – ergänzen und rückwärts rechnen.",
      hash: () => nw("Zahlenmauern Klasse 2", "grade2", "p", 4, 0, 0, 3202) },
    { level: "schwer", label: "Schwer", desc: "4 Mauern mit 5 Grundsteinen bis 100, Lücken in mehreren Reihen.",
      hash: () => nw("Zahlenmauern Klasse 2", "grade2", "p", 4, 5, 0, 3203) }
  ] },
  { slug: "zahlenmauern-klasse-3", gen: NWG, kind: "nw", sheets: [
    { level: "leicht", label: "Leicht", desc: "6 Mauern mit 4 Grundsteinen bis 1000. Die unterste Reihe ist vorgegeben.",
      hash: () => nw("Zahlenmauern Klasse 3", "grade1", "p", 6, 0, 1000, 3301) },
    { level: "mittel", label: "Mittel", desc: "4 Mauern bis 1000 mit nur vier Vorgaben, auch unten fehlen Zahlen.",
      hash: () => nw("Zahlenmauern Klasse 3", "pro", "p", 4, 0, 0, 3302) },
    { level: "schwer", label: "Schwer", desc: "4 Mauern mit 5 Grundsteinen bis 1000, unten mindestens zwei Lücken.",
      hash: () => nw("Zahlenmauern Klasse 3", "master", "p", 4, 0, 0, 3303) }
  ] },
  { slug: "zahlenmauern-klasse-4", gen: NWG, kind: "nw", sheets: [
    { level: "leicht", label: "Leicht", desc: "4 Mauern mit 5 Grundsteinen bis 10.000. Die unterste Reihe ist vorgegeben.",
      hash: () => nw("Zahlenmauern Klasse 4", "grade1", "p", 4, 5, 10000, 3401) },
    { level: "mittel", label: "Mittel", desc: "4 Mauern bis 10.000 mit nur vier Vorgaben, auch unten fehlen Zahlen.",
      hash: () => nw("Zahlenmauern Klasse 4", "pro", "p", 4, 0, 10000, 3402) },
    { level: "schwer", label: "Schwer", desc: "3 Mauern mit 6 bis 7 Grundsteinen bis 10.000 – zum Knobeln.",
      hash: () => nw("Zahlenmauern Klasse 4", "crazy", "p", 4, 0, 0, 3403) }
  ] },
  { slug: "malmauern", gen: NWG, kind: "nw", sheets: [
    { level: "leicht", label: "Leicht", desc: "6 Malmauern mit 3 Grundsteinen, Ergebnisse bis 20. Einmaleins mit kleinen Zahlen.",
      hash: () => nw("Malmauern", "starter", "m", 6, 0, 0, 3501) },
    { level: "mittel", label: "Mittel", desc: "6 Malmauern, Ergebnisse bis 50. Die unterste Reihe ist vorgegeben.",
      hash: () => nw("Malmauern", "grade1", "m", 6, 0, 0, 3502) },
    { level: "schwer", label: "Schwer", desc: "6 Malmauern bis 100, auch unten fehlen Zahlen – hier hilft Teilen.",
      hash: () => nw("Malmauern", "grade2", "m", 6, 0, 0, 3503) }
  ] }
];

function hashString(h) {
  return "#" + new URLSearchParams(h).toString();
}

// ---------- Static file server (127.0.0.1, random port) ----------

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".pdf": "application/pdf", ".json": "application/json", ".xml": "application/xml" };

function serve() {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = resolve(ROOT, "." + p);
    if (!file.startsWith(ROOT + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// ---------- Minimal CDP client ----------

async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "build-themes-"));
  const proc = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "about:blank"], { stdio: "ignore" });
  const portFile = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await new Promise((r) => setTimeout(r, 100));
  const port = readFileSync(portFile, "utf8").split("\n")[0].trim();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  const sock = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { sock.onopen = ok; sock.onerror = fail; });
  let id = 0;
  const pending = new Map(), listeners = [];
  sock.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method) {
      listeners.slice().forEach((l) => l(msg));
    }
  };
  const send = (method, params = {}) => new Promise((ok, fail) => {
    pending.set(++id, { ok, fail });
    sock.send(JSON.stringify({ id, method, params }));
  });
  const once = (method) => new Promise((ok) => {
    const l = (m) => { if (m.method === method) { listeners.splice(listeners.indexOf(l), 1); ok(m.params); } };
    listeners.push(l);
  });
  const errors = [];
  listeners.push((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text +
      " " + (m.params.exceptionDetails.exception || {}).description);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(JSON.stringify(m.params.args));
  });
  await send("Page.enable");
  await send("Runtime.enable");
  return {
    errors,
    async open(url) {
      const loaded = once("Page.loadEventFired");
      await send("Page.navigate", { url });
      await loaded;
    },
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + ((r.exceptionDetails.exception || {}).description || ""));
      return r.result.value;
    },
    async close() {
      try { await send("Browser.close"); } catch (e) { /* already gone */ }
      sock.close();
      await new Promise((r) => setTimeout(r, 300));
      try { proc.kill(); } catch (e) { /* ignore */ }
      try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Chrome may still hold files */ }
    }
  };
}

// In-page builders: same calls as the generators' PDF buttons.
const IN_PAGE = {
  ws: `(function (H, TITLE, D, F) {
    var st = WordSearch.fromHash(H), pz = WordSearch.build(st);
    var pages = [WordSearch.drawPage(st, pz, false), WordSearch.drawPage(st, pz, true)];
    return { pages: pages, missing: pz.missing.map(function (w) { return w.label; }), notes: [], fallback: false };
  })`,
  nw: `(function (H, TITLE, D, F) {
    var st = NumberWallApp.fromHash(H), sh = NumberWall.build(st, Sheet.rng);
    var pages = [NumberWall.drawPage(Sheet, st, sh, false), NumberWall.drawPage(Sheet, st, sh, true)];
    return { pages: pages, missing: [], notes: sh.p.notes, fallback: sh.walls.some(function (w) { return w.fallback; }) };
  })`
};
function inPage(kind, hash, title, fileId) {
  const args = [hash, title, PDF_DATE, fileId].map((a) => JSON.stringify(a)).join(", ");
  return `(function () {
    var r = ${IN_PAGE[kind]}(${args});
    var bytes = Sheet.toPDFBytes(r.pages, ${JSON.stringify(title)}, { date: ${JSON.stringify(PDF_DATE)}, fileId: ${JSON.stringify(fileId)} });
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { pdf: btoa(bin), svg: Sheet.toSVG(r.pages[0]), missing: r.missing, notes: r.notes, fallback: r.fallback };
  })()`;
}

// ---------- Page block ----------

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// Preview: 3 decimals are plenty for a 210 mm sheet and keep the page small.
function compactSvg(svg, label) {
  return svg.replace(/(\d+\.\d{3})\d+/g, "$1").replace('role="img"', 'role="img" aria-label="' + esc(label) + '"');
}

function cardHtml(page, sh, svg) {
  const pdf = `/lernmaterial/${page.slug}/${page.slug}-${sh.level}.pdf`;
  return `      <figure class="ts-card">
        <div class="sheet">${compactSvg(svg, "Vorschau: Arbeitsblatt " + sh.label)}</div>
        <figcaption>
          <h3>${esc(sh.label)}</h3>
          <p>${esc(sh.descText)}</p>
          <a class="b primary" href="${pdf}" download><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>PDF herunterladen</a>
          <a class="ts-tweak" href="${page.gen}${esc(sh.hashStr)}">Im Generator anpassen</a>
        </figcaption>
      </figure>`;
}

function replaceBlock(html, block, file) {
  const a = "<!-- build:sheets -->", b = "<!-- /build:sheets -->";
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < i) throw new Error("No build:sheets block in " + file);
  return html.slice(0, i + a.length) + "\n" + block + "\n      " + html.slice(j);
}

// ---------- Main ----------

const server = await serve();
const base = "http://127.0.0.1:" + server.address().port;
const chrome = await launchChrome();
let problems = 0, changed = 0;
try {
  let current = null, themes = null;
  for (const page of PAGES) {
    if (current !== page.gen) {
      await chrome.open(base + page.gen);
      current = page.gen;
      if (page.kind === "ws") themes = await chrome.eval("WordSearch.THEMES");
    }
    const all = page.theme ? themes[page.theme][1].split(", ") : null;
    const cards = [];
    for (const sh of page.sheets) {
      const h = sh.hash(all);
      sh.hashStr = hashString(h);
      sh.descText = sh.desc || `Alle ${all.length} Wörter, ${h.g.replace("x", " × ")} Felder, in alle acht Richtungen, auch rückwärts. Kleinbuchstaben. Für Klasse 3 und 4.`;
      const name = `${page.slug}-${sh.level}`;
      const fileId = createHash("md5").update(name).digest("hex").toUpperCase();
      const title = h.t + " (" + sh.label.toLowerCase() + ")";
      const r = await chrome.eval(inPage(page.kind, sh.hashStr, title, fileId));
      // The 3-wall cap for 6+ bottom blocks is expected (crazy level), not a problem.
      r.notes = r.notes.filter((n) => !/^ab 6 Grundsteinen/.test(n));
      if (r.missing.length || r.notes.length || r.fallback) {
        problems++;
        console.error(`PROBLEM ${name}: missing=${r.missing.join(",")} notes=${r.notes.join(",")} fallback=${r.fallback}`);
      }
      const pdf = Buffer.from(r.pdf, "base64");
      const pdfPath = join(ROOT, "lernmaterial", page.slug, name + ".pdf");
      const old = existsSync(pdfPath) ? readFileSync(pdfPath) : null;
      if (!old || !old.equals(pdf)) { changed++; console.log((CHECK ? "would change " : "wrote ") + name + ".pdf"); }
      if (!CHECK) writeFileSync(pdfPath, pdf);
      cards.push(cardHtml(page, sh, r.svg));
    }
    const htmlPath = join(ROOT, "lernmaterial", page.slug, "index.html");
    const html = readFileSync(htmlPath, "utf8");
    // "Eigene Variante im Generator": the medium sheet's settings, without
    // seed, so the generator mixes a new sheet.
    const mid = Object.assign({}, page.sheets[1].hash(all));
    delete mid.s;
    const cta = page.gen + esc(hashString(mid));
    let next = replaceBlock(html, cards.join("\n"), htmlPath);
    if (!/class="b primary ts-cta-link" href="[^"]*"/.test(next)) throw new Error("No ts-cta-link in " + htmlPath);
    next = next.replace(/(class="b primary ts-cta-link" href=")[^"]*"/, (m, a) => a + cta + '"');
    if (next !== html) { changed++; console.log((CHECK ? "would change " : "updated ") + page.slug + "/index.html"); }
    if (!CHECK) writeFileSync(htmlPath, next);
  }
  // Generator dropdown: every theme list must fit the default sheet (12 × 12, medium).
  await chrome.open(base + WS);
  const misfit = await chrome.eval(`Object.keys(WordSearch.THEMES).map(function (k) {
    var th = WordSearch.THEMES[k], st = WordSearch.fromHash("#" + new URLSearchParams({ t: "x", w: th[1].split(", ").join(","), g: "12x12", d: "E.S.SE", s: 7 }));
    var m = []; for (var s = 1; s <= 20; s++) { st.seed = s; m = m.concat(WordSearch.build(st).missing.map(function (w) { return w.label; })); }
    return m.length ? k + ": " + m.join(",") : "";
  }).filter(Boolean)`);
  if (misfit.length) { problems++; console.error("Theme lists not fitting 12x12 medium: " + misfit.join(" | ")); }
  if (chrome.errors.length) { problems++; console.error("Page errors: " + chrome.errors.join(" | ")); }
} finally {
  await chrome.close();
  server.close();
}
console.log(`${PAGES.length} pages, ${problems} problems, ${changed} ${CHECK ? "would change" : "changed"}.`);
process.exit(problems || (CHECK && changed) ? 1 : 0);
