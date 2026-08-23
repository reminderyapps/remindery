# Remindery Apps – Website

Statische Mini-Site des Herausgebers **Remindery Apps** (so heißt das
Play-Entwicklerkonto öffentlich). Kein Build-Schritt, keine externen
Ressourcen – keine Fonts, CDNs oder Tracker. Die Seite hält sich an dasselbe
Privacy-Versprechen wie die Apps.

Gehostet über GitHub Pages (Branch `main`, Root):
<https://reminderyapps.github.io/remindery/>

## Aufbau: zwei Ebenen

**Site-Ebene** – alles, was den Herausgeber und die Website betrifft:

| Datei | Inhalt |
|---|---|
| `index.html` | Familien-Landingpage, listet alle Apps |
| `datenschutz.html` / `datenschutz-en.html` | Datenschutz **der Website** |
| `impressum.html` / `legal-notice.html` | Anbieter-Impressum, gilt für alle Apps |

**App-Ebene** – ein Unterordner je App, gleicher Zuschnitt:

    geburtstage/    index.html, datenschutz.html, datenschutz-en.html
    silben-lesen/   index.html, datenschutz.html

Eine neue App bekommt einen neuen Ordner – **keine Dateien mehr im Root**.
Jede App-Datenschutzerklärung enthält den Website-Teil noch einmal
vollständig, weil Google Play eine Seite verlangt, die für sich allein steht.
Ein Impressum je App gibt es dagegen nicht: Anbieter ist immer
Remindery Apps.

Deutsch ist jeweils die Standardfassung, Englisch hängt am Sprach-Switch oben
rechts. Impressum und Datenschutz sind bewusst **getrennte Seiten** – nie
kombiniert.

## Was nicht angefasst werden darf

- **`index.html`, Meta-Tag `google-site-verification`** – über diese URL ist
  das Play-Entwicklerkonto verifiziert. Fällt das Tag weg, ist die
  Verifizierung futsch und muss vom Kontoinhaber neu gemacht werden.
- **`privacy.html` und `privacy-en.html`** – nur noch Weiterleitungen auf
  `geburtstage/`. Diese URLs stecken fest in allen ausgelieferten
  Installationen von Remindery: Geburtstage bis 1.1.0+4. Sie bleiben, solange
  solche Installationen im Umlauf sind.
- **`google-play-badge-de.png`** – unverändert von Google übernommen. Nur
  proportional skalieren, nicht zuschneiden, umfärben oder drehen; der weiße
  Rand ist die vorgeschriebene Schutzzone. Das Badge darf nur einen echten
  Store-Eintrag verlinken – für noch nicht veröffentlichte Apps steht
  stattdessen `.soon` in der Karte.

## Quellen und Abgleich

- Inhaltliche Quelle der Datenschutztexte: App-Repo `docs/legal/privacy-*.md`
  – Änderungen dort und hier synchron halten.
- Anbieterangaben (Name, Firmierung, Anschrift, Telefon, E-Mail) müssen mit
  `ProviderInfo` in den App-Repos und mit den Angaben in der Play Console
  übereinstimmen.
- `favicon.svg` ist das Zeichen von **Remindery Apps**: das Herz aus der
  Kerzenflamme des Cupcakes, auf einer umgedrehten Kachel (Korall statt
  Creme). Es ist Favicon der ganzen Site und sichtbares Logo auf der
  Familien-LP und den Rechtsseiten. `icon.svg` ist der Cupcake von
  Remindery: Geburtstage und gehört ausschließlich in `geburtstage/`.
- **Ansprache: Du auf den Werbeseiten, Sie in allen Rechtstexten** – also in
  Datenschutz, Impressum und auf den Weiterleitungsseiten.

## Veröffentlichen

Ausschließlich über `push.ps1` – die Prüfungen dort sind Absicht.
