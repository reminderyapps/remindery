# Auftrag: Website remindery.de „tip top" (PO 23.09.2026)

Stand: Entwurf, noch nicht begonnen. Zustand dieses Pakets lebt in dieser Datei
(Haken, Protokoll), nicht im Chatverlauf.

## Anlass

Seit 23.09.2026 läuft die Seite unter https://remindery.de (GitHub Pages, eigene
Domain, HTTPS). Silben Lesen und Uhr lesen lernen sind öffentlich im Play Store,
Ox folgt „jeden Tag". PO-Befund: Texte nicht werbefähig, Bilder teils alt oder
falsch (Uhr lesen lernen: Hero zeigt ein Zifferblatt mit Blöcken statt Zahlen).
„Jetzt wo wir sichtbarer werden" soll die Seite der erste Kontaktpunkt sein, der
zum Store-Auftritt passt.

Am 23.09. bereits erledigt: Play-Badges für Silben Lesen und Uhr lesen lernen auf
Startseite und Landingpages (Commit 75a611f), Canonical-Links auf remindery.de.

## Inventar (23.09.2026)

| Seite | Zeilen | Bilder | Store-Quelle für Text und Motive |
|---|---|---|---|
| `index.html` | 79 | favicon, Play-Badge | Dachmarke; Entwicklerseite https://play.google.com/store/apps/developer?id=Remindery+Apps |
| `geburtstage/index.html` | 40 | icon.svg, Badge | `apps/remind-birthdays/design/store`, Renderer `tool/render_store_assets_test.dart` |
| `silben-lesen/index.html` | 61 | `hero.png` 1024×500 | `apps/silben-app/design/store`, Renderer `tool/render_store_assets_test.dart` |
| `uhr-lesen-lernen/index.html` | 80 | `hero.png` 1024×500 **veraltet** | `apps/uhr-app-store/docs/store/listing.md`, Grafiken `apps/uhr-app-store/design/store` |
| `ox/index.html` | 83 | keine | `apps/vokabel-app/docs/store/listing.md`, `docs/store/final/v1` (8 Slides, Icon F07) |

Rechtstexte (`impressum.html`, `datenschutz*.html`, `privacy*.html`, je App
`datenschutz.html`) sind **nicht** Teil dieses Pakets, außer Kontaktadresse und
Hoster-Nennung (siehe Punkt 5). Styles in `styles.css` (eine Datei, CSS-Variablen).

## Grundsätze

- Website und Store tragen dasselbe Versprechen: Positionierung, Kernsätze und
  Frequenzbegriffe aus den `listing.md` übernehmen, nicht neu erfinden
  (Skill `store-auftritt`, Phase Positionierung/Texte, für die Frequenzprüfung).
- Optik: **erst Studie, dann bauen** – drei Richtungen auf Startseite plus einer
  Landingpage als HTML-Dateien unter `docs/studie/`, PO wählt, dann Umbau.
- Hero-Bilder aus dem Store-Renderer der jeweiligen App erzeugen (aktuelle
  App-Version, exakte Motive der Store-Slides), keine Fremdgrafiken.
- Keine Cookies, keine Tracker, keine externen Fonts ohne Prüfung
  (Datenschutzerklärung der Website nennt „keine Cookies, keine Tracker").
- Kein Play-Badge ohne öffentliche Store-Seite (Ox erst bei HTTP 200).
- Abnahme über lokale HTML-Seite, kein Artifact. Kein Push ohne PO-„Go" auf die
  Studie; nach dem Go allein bauen.

## Pakete

- [ ] **W1 Texte.** Je App aus `listing.md` einen Website-Text: Hero-Satz, 3 Nutzen,
      Eltern-Absatz, Preis-Satz. Startseite: Dachmarke in drei Sätzen, Grundsätze
      (keine Werbung, kein Tracking, einmal kaufen), Link Entwicklerseite.
      Frequenzprüfung gegen die Store-Titel. Ergebnis `docs/texte-2026-09.md`.
      **Dachmarken-Claim neu (PO 23.09.):** Der heutige Text „Apps, die eine Sache
      gut machen. Ohne Konto, ohne Werbung, ohne Cloud: Was du eingibst, bleibt auf
      deinem Gerät. Drei Apps sind bisher daraus geworden." ist (a) sachlich
      überholt – Ox verarbeitet Fotos auf unserem Server in Frankfurt, es sind vier
      Apps – und (b) dem PO „nicht fancy" genug. Was für alle vier weiterhin wahr
      ist: kein Konto, keine Werbung, kein Tracking, kein Abo-Zwang (einmal kaufen),
      Kinder-Apps ohne Zeitdruck und Ranglisten, gebaut in Deutschland. Was nur
      noch für drei gilt: komplett offline. Aufgabe: Claim so schreiben, dass Ox
      nicht lügt (Foto flüchtig, kein Konto, EU-Server) und trotzdem ein Versprechen
      mit Haltung bleibt – Richtung „Lern-Apps, die Eltern nichts abverlangen"
      statt Feature-Aufzählung. Drei Claim-Varianten in W2 mitzeigen.
- [ ] **W2 Studie.** Drei Richtungen (z. B. „ruhig/Aquarell", „klar/Schulheft",
      „bunt/Kinder-App") als komplette HTML-Seiten für `index.html` und
      `uhr-lesen-lernen/index.html`, gleiche Texte aus W1, Komponenten-Set
      (Karte, Badge, Hero, Liste). Übersichtsseite `docs/studie/index.html` zum
      Vergleich. → PO-Wahl.
- [ ] **W3 Bilder.** Hero je App aus dem Store-Renderer (1024×500 und 2×), Uhr
      mit Zahlen-Zifferblatt der aktuellen Version; Ox aus `final/v1`. Dateigröße
      < 150 KB je Bild (WebP mit PNG-Fallback prüfen).
- [ ] **W4 Umbau.** Gewählte Richtung auf alle fünf Seiten, `styles.css`
      konsolidieren, Phone-Breite prüfen (16 px Gutter, kein Querscroll).
- [ ] **W5 Kontakt/Hoster.** Kontaktadresse auf kontakt@remindery.de, in den
      Datenschutztexten der Website Hetzner statt Gmail als Postfach-Hoster
      (Vorgaben: `C:\privat\hq\operations\domain-und-mail.md`, Abschnitt „AVV –
      Kern“). Zeile O8 im Verzeichnis nachziehen.
- [ ] **W6 Ox-Badge** sobald `curl` auf die Play-Seite 200 liefert.
- [ ] **W7 Abnahme.** Lokale Vorschau, PO-Durchgang, Push, `status.md` der
      Ventures nachziehen (Silben, Uhr, Ox, Remindery).

## Protokoll

| Datum | Paket | Ergebnis |
|---|---|---|
| 2026-09-23 | – | Auftrag angelegt; Badges Silben/Uhr live (75a611f) |

## Startprompt (frische Session, cwd `C:\dev\web\remindery-site`)

```
Website-Paket remindery.de: Auftrag in docs/auftrag-website-2026-09.md lesen und
W1 (Texte) + W2 (Studie, drei Richtungen) bauen. Store-Listings der Apps sind
die Textquelle, Skill store-auftritt für die Frequenzprüfung. Ergebnis: Texte in
docs/texte-2026-09.md, Studie unter docs/studie/ mit Übersichtsseite, im Browser
öffnen. Nichts pushen, nichts an den Live-Seiten ändern, bis ich gewählt habe.
Protokoll in der Auftragsdatei führen.
```
