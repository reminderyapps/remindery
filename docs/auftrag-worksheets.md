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
