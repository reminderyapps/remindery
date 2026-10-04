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

- [ ] W1 Gewählte Richtung als neue Startseite `/` (Inhalte, Badges unverändert, Meta
      `google-site-verification` behalten), Stile in `styles.css` überführen
- [ ] W2 Englische Startseite `/en/` im selben Design; ehrlicher Satz: Apps derzeit für
      deutschsprachige Familien
- [ ] W3 Englische Kurzseiten `/en/ox/`, `/en/syllables/`, `/en/clock/`, `/en/birthdays/`
      (Inhalt aus den deutschen Seiten, keine neuen Behauptungen)
- [ ] W4 Kopfzeile auf ALLEN Seiten einheitlich: Apps · Über uns/About · Schalter DE|EN mit
      Gegenstück-Zuordnung; `<link rel="alternate" hreflang>` je Seitenpaar + `x-default`
- [ ] W5 Prüfung: Crawl (alle internen Links 200, Skript im Stil von migrate/crawl),
      360 px ohne Querscrollen, hell/dunkel; dann PO-Blick, dann `push.ps1`, live prüfen
- [ ] W6 `docs/study/` bleibt (Jekyll-`exclude: docs`), nichts davon live

## Protokoll

- 04.10.2026: Auftrag angelegt; PO wählt A. Bereit für W1–W5.
