# Auftrag: Lernmaterial / Arbeitsblätter (25.10.2026)

Herkunft: Umsatz-Workshop 10/2026, Paket J (SEO-Arbeitsblätter), vom PO am
25.10.2026 aus „Later“ geholt. Ziel: Suchtraffic für „Suchsel erstellen“ und
„Zahlenmauer“ auf remindery.de, Brücke zur App Rätselblock (/puzzles/).

Trends DE (PO, 25.10.): Suchsel steigend (Ø 21), Buchstabensalat fallend und
mehrdeutig, Wortgitter ≈ 0. Zahlenmauer stabil (Ø 20, Schulherbst 29/26),
Mathe Pyramide schwankend (Ø 21), Mathe Rätsel als Oberbegriff (Ø 43).

Entscheidungen: keine eigene Domain (PO). Pfade englisch wie der Rest der
Seite, Inhalt deutsch. Alles läuft im Browser, keine externen Requests
(jsPDF liegt lokal). Messung: Search Console, 4 Wochen Impressions,
8 Wochen Klicks, Abbruch < 100 Klicks nach 8 Wochen.

## Pakete

- [x] 1 Konkurrenz-Check suchsel.de, suchsel-generator.de, Zahlenmauer-Seiten → `docs/worksheets-konkurrenz.md`
- [x] 2 Suchsel-Generator `/worksheets/word-search/` (Wörter, Richtungen, Größe, PDF + Lösung, Link teilen)
- [x] 3 Zahlenmauer-Generator `/worksheets/math/number-wall/` (Stufen, PDF + Lösung), Weiterleitung `/worksheets/math/pyramid/`
- [x] 4 Übersicht `/worksheets/` (Mathe, Deutsch), Link von `/` und `/puzzles/`, Sitemap
- [x] 5 Design-Kritik + QA (PDF-Ausgabe, Handy-Breite, Dark Mode)
- [x] 6 Live (push.ps1) 25.10.2026, Commit 2ff7cb6. Search Console liest die Sitemap selbst neu.

## Protokoll

- 25.10. Gemeinsame Basis `worksheets/sheet.js` (Blatt als Zeichenbefehle in mm →
  SVG-Vorschau und PDF, Seed-Zufall), `worksheets.css`, jsPDF 2.5.1 in
  `worksheets/vendor/`. Suchsel fertig inkl. ß als ein Feld, Schimpfwort-Filter
  beim Auffüllen, Themenlisten, Link-Hash. Übersicht, Sitemap, Nav-Link auf `/`,
  Abschnitt „Rätsel zum Ausdrucken“ auf `/puzzles/`.
- 25.10. Zahlenmauer-Generator (Agent): `math/number-wall/wall.js` reine Logik,
  `selftest.js` (`node worksheets/math/number-wall/selftest.js`) prüft Eindeutigkeit
  und Zahlenraum je Stufe. Design-Kritik (6,5 → 8,5/10) und QA mit echten PDFs.
  Live 25.10.2026. Nächste Messpunkte: 22.11. Impressions, 20.12. Klicks
  (Abbruch < 100 Klicks). Nächste Kandidaten: Uhr-Arbeitsblätter, Profi-Pyramiden-Seite.
- 25.10. PO-Runde: Kostenlos-Hinweise, „Generator“ im Wording, Store-Badges, Plus-/Mal-Mauer
  mit Icons, mehrere Blätter je PDF, Regler Gitter/Wörter, Breadcrumb, einheitliches
  Hauptmenü und Fuß mit Lernmaterial auf allen Seiten.
- 25.10. Umzug auf deutsche Pfade (Ausnahme in der Namensregel): `/lernmaterial/`,
  `/lernmaterial/suchsel-generator/`, `/lernmaterial/zahlenmauer-generator/`; alte
  `/worksheets/…`-Seiten leiten weiter, Assets bleiben unter `/worksheets/`.
  Englisch: `/en/worksheets/`, `…/word-search-generator/`, `…/number-pyramid-generator/`,
  Skripte zweisprachig (`STR = {de, en}` je Datei, Sprache aus `<html lang>`).
  Search Console 27.10.: `/lernmaterial/` indexiert (gecrawlt 25.10. 23:25). Sitemap zuletzt
  gelesen 24.10. (34 Seiten, ohne Lernmaterial) → PO reicht sie neu ein (Soll: 54). Offen beim PO:
  die 5 Generator-Adressen per URL-Prüfung, bei „nicht auf Google“ Indexierung beantragen.
- 25.10. Verzeichnis-Einträge (Kopierseite `docs/verzeichnisse-lernmaterial.html`):
  Deutscher Bildungsserver, Onlineressource **Zahlenmauer-Generator eingereicht,
  Eingangs-ID 9566** (Fach + ELIXIER: Schule › Grundschule › Mathematik › Rechnen,
  Rechte „Sonstige Lizenz“, Kontakt hello@remindery.de). Prüfung „ein paar Tage“.
  **Suchsel-Generator eingereicht, Eingangs-ID 9567** (Titel „Suchsel-Generator – Suchsel
  und Wortgitter kostenlos erstellen, mit Lösung als PDF“, Fach + ELIXIER: Schule ›
  Grundschule › Deutsch › Lesen). Offen: WirLernenOnline, 4teachers (Konto = PO), ZUM-Mail.
- 25.10. WirLernenOnline: beide Generatoren als „Tool“ vorgeschlagen (laut PO; ohne
  Eingangs-ID, Formular gibt keine aus), Lizenz „Sonstige Lizenzen“ mit Lizenzsatz in der
  Kurzbeschreibung. 4teachers und ZUM vom PO zurückgestellt („die ersten beiden reichen erstmal“).
  Nächster Blick: ob Bildungsserver (9566, 9567) und WLO freigeschaltet haben – mit den
  Messpunkten 22.11. / 20.12.
- 25.10. Themenseiten live (Agent): /lernmaterial/suchsel-{weihnachten,advent,winter,herbst,tiere}/,
  /lernmaterial/zahlenmauern-klasse-{1..4}/, /lernmaterial/malmauern/ – je 3 fertige PDFs mit
  Lösung (30 PDFs), Vorschau, Link in den Generator. Build: `node tool/worksheets/build_themes.mjs`
  (`--check` = nur prüfen, feste Seeds). Erzeugte Arbeitsblätter gemeinfrei (CC0 1.0): Fuß auf
  jedem Blatt, FAQ, Plaketten, JSON-LD `license` auf den Themenseiten. App-Kasten auf dem
  Lösungsblatt = Board STDIO-a0046 (später).
