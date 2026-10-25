# Konkurrenz-Check Arbeitsblatt-Generatoren (Stand 25.10.2026)

Methode: WebFetch der Seiten, WebSearch (US-Index, daher kein echtes deutsches Google-Ranking). Nur Angaben, die die Seiten selbst nennen. Nicht bedient oder nicht erwähnt = "nicht genannt", nicht "fehlt sicher". Seiten wurden nicht im Browser bedient, Werbung und Bedienkomfort nur aus Seitentext.

## Suchsel

| Anbieter | Optionen laut Seite | Gestaltung / Werbung / Login | Ärgerlich / fehlt |
|---|---|---|---|
| suchsel.de | Kein Generator. Werbeseite für drei Suchsel-Bücher bei Amazon, dazu Gratis-PDFs (Inhaltsverzeichnis, Bonus 1-6, "150 Lösungen"). Titelbild nennt "KI-Bilder" und Großdruck. | Schlicht, nur Links; kein Login genannt. | Lösungs-PDFs 27-28 MB; kein Online-Tool, kein eigenes Wortlisten-Eingeben. |
| suchsel-generator.de | 301-Weiterleitung auf wortsuche-erstellen.de (siehe nächste Zeile). | - | - |
| wortsuche-erstellen.de | Wörter 3-15 Buchstaben, max. 30; optionaler Titel; Größe 10/15/20/25; Schwierigkeit Einfach (waagerecht/senkrecht), Mittel (+diagonal), Schwer (+rückwärts); Wortliste im PDF ein/aus; ä ö ü ß (ß als SS); PDF 2 Seiten: Rätsel + Lösung; "Erweiterte Optionen" erwähnt, nicht beschrieben. | "Kostenlos & ohne Anmeldung", läuft im Browser, Eingaben lokal gespeichert. "Anzeige" mehrfach auf der Seite, viel Verweiswerbung auf andere Tools. | Richtungen nur als Stufen-Bündel, nicht einzeln anhakbar; keine feste Wahl Groß/Klein, Füllbuchstaben, Formen, Bilder genannt; ß wird zu SS. |
| miniwebtool.com (Wortsuche-Rätsel-Generator) | 8x8 bis 25x25; Einfach/Mittel/Schwer wie oben; bis 50 Wörter (min. 2 Buchstaben); Lösung ein/aus; Druckansicht, kein PDF genannt; 5 Farbthemen. Füllung zufällige Großbuchstaben. Umlaute nicht erwähnt. | Werbefinanziert; Adblocker-Sperre blockiert das Tool bis Freigabe oder Upgrade; "3x täglich kostenlos", Premium für mehr + kommerziell. | Tageslimit, Upgrade-Aufforderungen, Adblock-Modal. |
| univers.studio (nur Suchtreffer-Text) | Eigene Wörter oder Thema; Ausgabe 300-DPI-PNG mit Lösung; "kostenlos, ohne Anmeldung". | Nicht geprüft. | PDF laut Treffertext nicht genannt. |
| kdpeasy.com | Ganze Bücher (100 Rätsel), Listen 10-25 Wörter, ä ö ü ß je 1 Feld, Lösungsteil, 300-DPI-Druck-PDF. | Bezahlt, ab 3 USD pro Buch. | Zielgruppe Buchverleger, nicht Lehrkräfte. |

## Zahlenmauer

Im Suchtreffer-Sample fand sich kein Anbieter, der unter "Zahlenmauer Arbeitsblatt/Generator" einen Generator mit freier Stufenwahl und Lösungs-PDF belegt zeigt. Oben stehen fertige PDF-Sammlungen.

| Anbieter | Optionen laut Seite | Werbung / Login | Ärgerlich / fehlt |
|---|---|---|---|
| matheaufgaben.net (Mathe-Trainer) | 3 Grundsteine: Leicht/Mittel/Schwer, Zahlenraum 10, 20, 50, 100 (Zehner), 100, 500, 1000. 4 Grundsteine: zusätzlich "Extrem", Zahlenraum 20-1000; Mittel 11 Muster, Schwer 14. Online lösbar; laut Bildungsserver auch PDF-Blätter (Lösung auf Seite nicht belegt). | Werbefinanziert (laut Bildungsserver). Login nicht genannt. | Feste Muster statt freier Wahl; nur 3-4 Grundsteine genannt. |
| grundschule-arbeitsblaetter.de | Arbeitsblatt-Generator, kostenlos, PDF, "beliebig viele"; Rechenart und "Details" wählbar, nicht benannt. Fertige Sammlung daneben. | Mehrere "ANZEIGE"-Blöcke, Amazon-Affiliate-Links. Login nicht genannt. | Optionen und Lösung auf der Seite nicht belegt. |
| grundschulkoenig.de | Blätter Kl. 1 (ZR 10, 20) und Kl. 2 (ZR 100) mit Lösungen. | Erstes Blatt gratis, mehr im kostenpflichtigen Paket. | Feste Blätter, Bezahlschranke. |
| schulkreis.de | Kl. 2-4; 3 Grundsteine bis 20, 4 Grundsteine bis 1000; Lösungen im PDF. | Nicht geprüft. | Feste Blätter. |
| mathe-in-smarties.de, kekula.de | Feste PDFs: ZR 10/20/100/1000, Kl. 1-4, leere Vorlagen. | Nicht geprüft. | Keine Variation pro Klick. |
| meinunterricht.de | Zahlenmauer-Materialsammlung. | Laut Treffer teils kostenpflichtig. | - |

## Was wir besser machen müssen

### Suchsel
1. Richtungen einzeln anhaken (8 Checkboxen) statt Stufen-Bündel; Presets zusätzlich als Schnellwahl.
2. Umlaute und ß korrekt als je ein Feld (kdpeasy belegt es als Qualitätsmerkmal; wortsuche-erstellen macht SS).
3. PDF mit Rätsel plus Lösung, A4-druckfertig, ohne Wasserzeichen, ohne Tageslimit, ohne Login und ohne Adblock-Sperre.
4. Wortlimit großzügig (mindestens 30, besser 40-50), Gittergröße frei wählbar (nicht nur 4 Stufen), Fehlermeldung warum ein Wort nicht passt.
5. Groß-/Kleinschreibung und Schriftart/-größe wählbar (Schulschrift/Großdruck für Klasse 1-2).
6. Füllbuchstaben: Zufall oder deutsche Buchstabenhäufigkeit (pysuchsel belegt das Konzept), ohne versehentliche Wörter (Hamburger Handreichung nennt das als Lehrerproblem).
7. Lösung wahlweise markiert im Gitter, Wortliste ein/aus, Titel und Namenszeile.
8. Neu mischen per Klick mit gleicher Wortliste; Wortlisten im Browser speichern (wortsuche-erstellen tut das).
9. Themen-Wortlisten für Lehrkräfte (Jahreszeiten, Tiere, Lernwörter) als Startpunkt.
10. Ruhige Seite: keine Anzeigenflächen um das Tool, Datenschutz-Hinweis "bleibt im Browser".

### Zahlenmauer
1. Es gibt im Sample keinen belegten freien Generator: Kernvorteil ist Wahl statt fester Blätter (Stufen Kl. 1 bis "verrückt", Zahlenraum, Anzahl Mauern je Blatt).
2. Lösungs-PDF immer mit dabei (Seite 2 oder eigene Datei), Wiederholung mit neuem Zufall per Klick.
3. Höhe 3 bis 5 Stufen wählbar (Konkurrenz nennt nur 3-4 Grundsteine).
4. Gegebene Steine sinnvoll wählen: genau eindeutig lösbar garantieren, keine Bruch-/Negativwerte unterhalb der Stufe.
5. Varianten: Addition, Subtraktion, Multiplikation (Sachsen-Anhalt-Unterlage nennt beide) und Zielzahl-Aufgaben.
6. Keine Registrierung, keine Werbung, kein Limit; Druck-Layout A4 mit mehreren Mauern pro Seite.
