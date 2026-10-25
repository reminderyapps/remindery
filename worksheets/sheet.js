/* Arbeitsblatt-Zeichenbasis für /worksheets/.
   Ein Blatt ist eine Liste von Zeichenbefehlen in mm auf A4 hochkant. Dieselbe
   Liste wird zur Vorschau (SVG) und zum PDF (jsPDF, liegt lokal) – die Vorschau
   ist damit exakt der Druck. Schrift überall Helvetica (PDF-Standardschrift,
   kann Ä Ö Ü ß ohne eingebettete Datei). Texte deutsch oder englisch je nach
   <html lang>, siehe STR. */
window.Sheet = (function () {
  "use strict";

  var W = 210, H = 297, MARGIN = 18;
  var INK = "#2B2622", SOFT = "#8A7F75", LINE = "#C9C1B8";
  var NAME = "#6E6258"; // Beschriftung Name/Datum: weich, aber auf Papier gut lesbar
  var PT = 0.3528; // 1 pt in mm

  // Sprache der Seite (<html lang>): "de" (Standard, auch in Node/selftest)
  // oder "en". Alle sichtbaren Texte des Blatts kommen aus dieser Tabelle.
  var LANG = typeof document !== "undefined" && document.documentElement &&
    /^en\b/i.test(document.documentElement.lang || "") ? "en" : "de";
  var STR = {
    de: { name: "Name:", date: "Datum:", footer: "Kostenlos erstellt auf remindery.de/lernmaterial · gemeinfrei (CC0)" },
    en: { name: "Name:", date: "Date:", footer: "Free from remindery.de/en/worksheets · public domain (CC0)" }
  };
  function str() { return STR[api.lang] || STR.de; }

  // Nur Zeichen, die Helvetica im PDF kennt (WinAnsi); alles andere fällt weg.
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

  function Page() { this.ops = []; }
  Page.prototype.text = function (x, y, s, o) {
    o = o || {};
    // WinAnsi-Filter schon hier, damit Vorschau und PDF dasselbe zeigen.
    this.ops.push({ t: "text", x: x, y: y, s: winAnsi(String(s)), size: o.size || 11,
      bold: !!o.bold, italic: !!o.italic, align: o.align || "left", color: o.color || INK });
    return this;
  };
  Page.prototype.line = function (x1, y1, x2, y2, o) {
    o = o || {};
    this.ops.push({ t: "line", x1: x1, y1: y1, x2: x2, y2: y2, w: o.width || 0.3,
      color: o.color || INK, round: !!o.round });
    return this;
  };
  Page.prototype.rect = function (x, y, w, h, o) {
    o = o || {};
    this.ops.push({ t: "rect", x: x, y: y, w: w, h: h, r: o.radius || 0,
      fill: o.fill || null, stroke: o.stroke || null, sw: o.width || 0.3 });
    return this;
  };

  // Gemeinsamer Kopf: Titel, optional Name/Datum-Zeile. Gibt die y-Position
  // zurück, ab der der Inhalt beginnen darf. o.blank: Name/Datum und Anleitung
  // nicht zeichnen, aber ihren Platz frei lassen – so liegt das Rätsel auf dem
  // Lösungsblatt genau an derselben Stelle wie auf dem Aufgabenblatt.
  Page.prototype.header = function (title, o) {
    o = o || {};
    var y = MARGIN + 8;
    this.text(MARGIN, y, title || "", { size: 22, bold: true });
    if (o.tag) {
      // Kennung rechts als ruhige Plakette (z. B. „Lösung“), Breite grob nach Zeichen.
      var tw = o.tag.length * 10 * PT * 0.6 + 7;
      this.rect(W - MARGIN - tw, y - 5.4, tw, 7.4, { stroke: LINE, width: 0.3, radius: 3.7 });
      this.text(W - MARGIN - tw / 2, y - 0.4, o.tag, { size: 10, bold: true, align: "center", color: SOFT });
    }
    y += 5;
    // Feine Linie unter dem Titel: gibt dem Kopf Halt, ohne Druckfarbe zu kosten.
    this.line(MARGIN, y - 0.5, W - MARGIN, y - 0.5, { width: 0.35, color: LINE });
    if (o.nameLine) {
      y += 9;
      if (!o.blank) {
        this.text(MARGIN, y, str().name, { size: 11, color: NAME });
        this.line(MARGIN + 13, y + 0.8, 120, y + 0.8, { width: 0.3, color: LINE });
        this.text(128, y, str().date, { size: 11, color: NAME });
        this.line(142, y + 0.8, W - MARGIN, y + 0.8, { width: 0.3, color: LINE });
      }
    }
    if (o.instruction) {
      y += 9;
      if (!o.blank) this.text(MARGIN, y, o.instruction, { size: 11 });
    }
    return y + 7;
  };
  Page.prototype.footer = function (text) {
    this.text(W / 2, H - 10, text || str().footer, {
      size: 8, align: "center", color: SOFT });
    return this;
  };

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function toSVG(page) {
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H +
      '" font-family="Helvetica, Arial, sans-serif" role="img">',
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>'];
    page.ops.forEach(function (o) {
      if (o.t === "rect") {
        out.push('<rect x="' + o.x + '" y="' + o.y + '" width="' + o.w + '" height="' + o.h +
          '" rx="' + o.r + '" fill="' + (o.fill || "none") + '" stroke="' + (o.stroke || "none") +
          '" stroke-width="' + o.sw + '"/>');
      } else if (o.t === "line") {
        out.push('<line x1="' + o.x1 + '" y1="' + o.y1 + '" x2="' + o.x2 + '" y2="' + o.y2 +
          '" stroke="' + o.color + '" stroke-width="' + o.w + '" stroke-linecap="' +
          (o.round ? "round" : "butt") + '"/>');
      } else {
        var anchor = o.align === "center" ? "middle" : o.align === "right" ? "end" : "start";
        out.push('<text x="' + o.x + '" y="' + o.y + '" font-size="' + (o.size * PT).toFixed(3) +
          '" font-weight="' + (o.bold ? 700 : 400) + (o.italic ? '" font-style="italic' : "") +
          '" text-anchor="' + anchor + '" fill="' +
          o.color + '">' + esc(o.s) + "</text>");
      }
    });
    out.push("</svg>");
    return out.join("");
  }

  // Baut das jsPDF-Dokument. o.date (Date) und o.fileId (32 Hex-Zeichen)
  // machen das PDF bytegleich reproduzierbar (fertige Themen-Blätter,
  // tool/worksheets/build_themes.mjs); ohne sie wie bisher.
  function makeDoc(pages, title, o) {
    o = o || {};
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });
    doc.setProperties({ title: title, creator: "remindery.de/worksheets" });
    if (o.date) doc.setCreationDate(o.date);
    if (o.fileId) doc.setFileId(o.fileId);
    pages.forEach(function (page, i) {
      if (i) doc.addPage();
      page.ops.forEach(function (o) {
        if (o.t === "rect") {
          var style = o.fill && o.stroke ? "FD" : o.fill ? "F" : "S";
          if (o.fill) doc.setFillColor(o.fill);
          if (o.stroke) { doc.setDrawColor(o.stroke); doc.setLineWidth(o.sw); }
          if (o.r) doc.roundedRect(o.x, o.y, o.w, o.h, o.r, o.r, style);
          else doc.rect(o.x, o.y, o.w, o.h, style);
        } else if (o.t === "line") {
          doc.setDrawColor(o.color); doc.setLineWidth(o.w);
          doc.setLineCap(o.round ? "round" : "butt");
          doc.line(o.x1, o.y1, o.x2, o.y2);
        } else {
          doc.setFont("helvetica", o.bold ? (o.italic ? "bolditalic" : "bold") : (o.italic ? "italic" : "normal"));
          doc.setFontSize(o.size); doc.setTextColor(o.color);
          doc.text(o.s, o.x, o.y, { align: o.align });
        }
      });
    });
    return doc;
  }

  function toPDF(pages, filename, title) {
    makeDoc(pages, title || filename).save(filename);
  }

  // Wie toPDF, aber ohne Speichern: die PDF-Bytes als Uint8Array.
  function toPDFBytes(pages, title, o) {
    return new Uint8Array(makeDoc(pages, title || "", o).output("arraybuffer"));
  }

  // Seed-fähiger Zufall (mulberry32): gleicher Seed = gleiches Blatt, damit
  // ein geteilter Link genau dieses Rätsel wieder erzeugt.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function newSeed() { return Math.floor(Math.random() * 1e9); }

  var api = { W: W, H: H, MARGIN: MARGIN, INK: INK, SOFT: SOFT, LINE: LINE, PT: PT,
    Page: Page, toSVG: toSVG, toPDF: toPDF, toPDFBytes: toPDFBytes, rng: rng, newSeed: newSeed, winAnsi: winAnsi,
    lang: LANG };
  return api;
})();
