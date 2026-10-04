# Auftrag: Startseite neu + echter Sprachschalter (PO 04.10.2026)

Zustand dieses Pakets lebt in dieser Datei (Haken, Protokoll), nicht im Chatverlauf.

## Stand vor dem Paket (04.10.2026)

- Englische Pfade live (17755c1): Deutsch an der Wurzel, Englisch unter `/en/`,
  alte Adressen als Weiterleitung (Zuordnung: `C:\privat\hq\operations\domain-und-mail.md`,
  Abschnitt „Website-Pfade"). PO-Regel: alle technischen Bezeichner englisch.
- Studio-Seite `/about/` (DE) und `/en/about/` (EN), Kontakt hello@remindery.de.
- Kopfzeile 271a54d (lokal, evtl. gepusht): Apps · Über uns · Umschalter DE|EN.
  **PO-Befund:** DE|EN sieht aus wie ein Sprachschalter, springt aber auf die About-Seite.
- PO-Befund Startseite: der Studio-Verweis (Band unter dem Hero) wirkt „reingequetscht ohne Design".
- Design-Studie (Opus-Agent): `docs/study/homepage-2026-10/` – Übersicht + Richtungen
  A „Studio-Kopf", B „Zwei Türen", C „Editorial" (Empfehlung Agent + Claude: C).
  Ansehen: `python -m http.server 8795 --directory c:\dev\web\remindery-site`,
  dann http://localhost:8795/docs/study/homepage-2026-10/

## Entscheidungen

- [x] **PO wählt Richtung A „Studio-Kopf“** (04.10.2026; Empfehlung war C, PO findet A am besten)
- [x] Frage Dunkelmodus-Inversion entfällt (betraf nur C)
- [x] Schriften: Systemschriften oder selbst gehostet, kein Google-Fonts-Einbinden
      (LG München 2022, Seite lädt nichts von Dritten)
- [x] Sprachschalter auf jeder Seite = echter Schalter: führt zur selben Seite in der
      anderen Sprache. Fehlt eine Übersetzung (Ox/Silben/Uhr-Datenschutz, Ox-Terms), führt
      EN zur englischen Seite der jeweiligen App.

## Pakete

- [x] W1 Gewählte Richtung als neue Startseite `/` (Inhalte, Badges unverändert, Meta
      `google-site-verification` behalten), Stile in `styles.css` überführen
- [x] W2 Englische Startseite `/en/` im selben Design; ehrlicher Satz: Apps derzeit für
      deutschsprachige Familien
- [x] W3 Englische Kurzseiten `/en/ox/`, `/en/syllables/`, `/en/clock/`, `/en/birthdays/`
      (Inhalt aus den deutschen Seiten, keine neuen Behauptungen)
- [x] W4 Kopfzeile auf ALLEN Seiten einheitlich: Apps · Über uns/About · Schalter DE|EN mit
      Gegenstück-Zuordnung; `<link rel="alternate" hreflang>` je Seitenpaar + `x-default`
- [x] W5 Prüfung: Crawl (alle internen Links 200, Skript im Stil von migrate/crawl),
      360 px ohne Querscrollen, hell/dunkel; dann PO-Blick, dann `push.ps1`, live prüfen
- [x] W6 `docs/study/` bleibt (Jekyll-`exclude: docs`), nichts davon live

## Protokoll

- 04.10.2026: Auftrag angelegt; PO wählt A. Bereit für W1–W5.
- 04.10.2026: W1–W4 gebaut. Kopfzeile + hreflang setzt `tool/header.py` (idempotent, Zuordnung
  DE↔EN dort in `PAIRS`), Startseiten-Stile unter `body.home` in `styles.css` (About belegt
  .studio/.stats/.founder/.btn). Linkfarbe global `--accent-text`. `tool/` per Jekyll-exclude
  nicht live. W5: `tool/crawl.py` (lokal OK, 22 Seiten + 16 Weiterleitungen) und
  `tool/viewport.py` (Edge headless, 88 Ansichten OK) – dabei vorbestehendes Querscrollen bei
  360 px behoben (lange Wörter in Rechtstexten, Hero-Wolken). Abnahme-Seite
  `docs/abnahme-website-2026-10.html` (Port 8795). Wartet auf PO-Blick, dann push + Live-Crawl.
- 04.10.2026: PO-Blick mit Textrunde auf Über uns: Grundsätze allgemein statt Ox-bezogen
  (Nutzer im Mittelpunkt · Apps der nächsten Generation · Das letzte Wort hat ein Mensch ·
  Privat ab Werk); Kinder-Versprechen nur für Kinder-Apps, weil Einkaufsliste/Wald Werbung
  planen. Kennzahl „30 Tage bis Play Store (Ox)" ersetzt durch „14 Tage im Schnitt Idee →
  Einreichung" (Geburtstage 05.→06.07., Silben 01.→21.08., Uhr 14.08.→06.09., Ox 03.→~14.09.).
  PO „push": gepusht (b9b9c6e), Pages gebaut, Live-Crawl OK (22 Seiten + 16 Weiterleitungen),
  viewport.py live OK (88 Ansichten), docs/ und tool/ live 404. **Auftrag abgeschlossen.**
