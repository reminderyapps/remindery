# Auftrag: Website-Relaunch „Startup“ (ab 10.10.2026)

Zweig `relaunch`, Worktree `C:\dev\web\remindery-site-relaunch`. GitHub Pages baut nur aus `main` –
der Zweig ist unsichtbar, bis er nach `main` gemergt wird (= Go-live, nur mit Go des PO).
Vorschau: `python -m http.server 8790 --bind 127.0.0.1 --directory C:\dev\web\remindery-site-relaunch`,
dann http://127.0.0.1:8790/method/

## Stand

- [x] Studie, drei Richtungen: `docs/studie/method-2026-10/` – PO wählt **A · Control Room** (dunkel, Raster, Mono-Zahlen)
- [x] `/method/` (DE) und `/en/method/` (EN), gemeinsames `method/method.css` + `method.js`, Systemschriften (keine Google Fonts)
- [x] Nav-Link „Methode/Method“ auf Start- und About-Seiten, Sitemap
- [x] Wording: „ergänzen ihren Prozess um KI“ statt „schrauben“ (PO 10.10.)
- [x] (10.10.) About-Seite an /method angleichen: „Apps in Wochen statt Jahren“ und „14 Tage im Schnitt“ sind überholt (Bautage siehe unten), Zahlen 4 → 5 Apps usw.
- [x] Startseite bleibt hell (PO 10.10.: „nicht so dunkel“). Stattdessen /method mit hellem Einstieg und Übergang (Denoising → neuronales Netz) in den dunklen Teil – live 10.10.
- [x] Vorschaubild og/remindery-en.png + -de.png (Vorlage docs/og/og-bild.html), OG-Tags auf Start/Methode/About; Nav „Apps“ → Seitenanfang – live 10.10.
- [x] 10.10.2026 live: /method + About (Go des PO), Pages-Build grün, Seiten live geprüft. Startseite folgt als nächstes Paket, danach erneut Go.
- [x] (10.10.) Tempo-Grafik nur noch Bautage (Kalender-Kästen raus), Geburtstage als PoC dazu – live.
- [x] (10.10.) /method als Betriebsmodell: neuer Kopf („A company run by agents. Steered by one human.“),
  These, sechs Prinzipien, Organigramm mit Reifegrad, Übersetzung; „Meet the agents“ geht im Organigramm auf.
  Quelle: `C:\privat\hq\ventures\remindery\organisation.md`. Dazu Gedächtnis-Grafik (Lauf lädt, schreibt zurück, Kontext weg) und aufklappbares Organigramm. Live 10.10. (f8008a2), geprüft.

## Zahlen (gezählt 10.10.2026, Skript-Logik unten)

Bautage = Tage mit Commits vom ersten Commit bis zur ersten Produktions-Einreichung (versionen.md je Repo):
Geburtstage (PoC) 4 / 27 (05.07. → Production 31.07.), Silben 9 / 22 Kalendertage, Uhr 7 / 38 (Einreichdatum nur „~20.09.“ – PO prüft in der Console),
Ubo 10 / 11, Einkaufsliste 5 / 11, Rätselheft 3 / 3. Store-Prüfzeit nicht eingerechnet.
Commits aller Repos (apps/*, remindery-site, hq, dedupliziert) 2.690; Tests (`test(`/`testWidgets(`) 4.391;
mp3-Clips silben+uhr+raetselblock 7.527; Board-Läufe seit 07.10. 32.
Nacht-Replay: Rätselblock-Git-Log 07.10. 23:34 → 08.10. 06:07, 121 Commits; Stunden 6/18/45/19/1/23/3/6.

## Entscheidungen

- Fehler-Abschnitt („Jede Regel wurde einmal bezahlt“) bleibt drin.
- Stufenleiter nur in eigenen Worten, auf Remindery angewendet (Ursprung: vertrauliches Papier, keine Formulierungen übernehmen).
- Arbeitgeber des PO wird nirgends genannt.
