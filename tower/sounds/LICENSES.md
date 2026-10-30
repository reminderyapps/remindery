# Klänge: Quellen und Lizenzen

Alle Dateien hier sind aus Kenney-Paketen übernommen (Lizenz in beiden Paketen geprüft:
`License.txt` = Creative Commons Zero, CC0 1.0, http://creativecommons.org/publicdomain/zero/1.0/).
Umgewandelt mit ffmpeg: mono, 44,1 kHz, MP3 64 kbit/s. Eingebettet in `../sounds.js` per
`node tool/build_sounds.js` (file:// erlaubt kein fetch). Download am 29.10.2026 von kenney.nl.

| Datei | Original | Paket | Lizenz |
|---|---|---|---|
| ui_click.mp3 | click_001.ogg | Interface Sounds 1.0 (Kenney, https://kenney.nl/assets/interface-sounds) | CC0 |
| ui_toggle.mp3 | toggle_002.ogg | Interface Sounds 1.0 | CC0 |
| ui_error.mp3 | error_008.ogg | Interface Sounds 1.0 | CC0 |
| build_wood_0.mp3 | impactWood_medium_000.ogg | Impact Sounds 1.0 (Kenney, https://kenney.nl/assets/impact-sounds) | CC0 |
| build_wood_1.mp3 | impactWood_medium_001.ogg | Impact Sounds 1.0 | CC0 |
| build_wood_2.mp3 | impactWood_medium_002.ogg | Impact Sounds 1.0 | CC0 |
| build_plank.mp3 | impactPlank_medium_000.ogg | Impact Sounds 1.0 | CC0 |
| build_metal.mp3 | impactMetal_medium_000.ogg | Impact Sounds 1.0 | CC0 |
| demolish_rubble.mp3 | impactMining_000.ogg | Impact Sounds 1.0 | CC0 |
| demolish_plate.mp3 | impactPlate_heavy_000.ogg | Impact Sounds 1.0 | CC0 |
| demolish_glass.mp3 | impactGlass_medium_000.ogg | Impact Sounds 1.0 | CC0 |
| step_0.mp3 … step_4.mp3 | footstep_concrete_000 … 004.ogg | Impact Sounds 1.0 | CC0 |

Alles andere (Vögel, Verkehr, Grillen, Brummen, Tippen, Telefon, Fernseher, Kinder, Gemurmel,
Geschirr, Gong, Einzug, Auszug, Stern, Kasse, Hall) wird zur Laufzeit per Web Audio erzeugt –
keine Fremddateien. freesound.org wurde nicht genutzt (Download nur mit Konto).

Spieltiefe (TOWER-a0006): Panne, Notdienst, Reparatur, Aufwertung, Warnung, Besuche (Café, Kita,
Supermarkt, Fitness, Restaurant) und die Raum-Ebenen Werkstatt, Café, Kita, Supermarkt, Fitness sind
ebenfalls synthetisiert – keine neuen Dateien, `sounds.js` unverändert.
