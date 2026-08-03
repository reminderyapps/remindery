# Remindery – Website

Statische Mini-Site der Remindery-App-Familie für **Remindery: Geburtstage**:
Landingpage (`index.html`), Datenschutzerklärung (`privacy.html` /
`privacy-en.html`) und Impressum (`impressum.html` / `legal-notice.html`).
Impressum und Datenschutz sind bewusst **getrennte Seiten** – nie kombiniert.
Deutsch ist jeweils die Standardfassung, Englisch hängt am Sprach-Switch
oben rechts.

- Kein Build-Schritt, keine externen Ressourcen (keine Fonts/CDNs/Tracker) –
  die Seite hält sich an dasselbe Privacy-Versprechen wie die Apps.
- Gehostet über GitHub Pages (Branch `main`, Root).
- Inhaltliche Quelle der Datenschutztexte: App-Repo `docs/legal/privacy-*.md`
  – Änderungen dort und hier synchron halten.
- Logo/Favicon: generiertes Icon-Motiv aus dem App-Repo
  (`lib/theme/brand_icon.dart` → `design/icon-final/`).
