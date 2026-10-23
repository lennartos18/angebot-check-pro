# Tiefenanalyse & Neuaufbau der Angebots-Prüfung (nur Handwerk)

## Ergebnis der Prüfung (was aktuell kaputt ist)

1. **Server war nicht erreichbar** – beim letzten Aufruf schlug schon das Laden der Gast-Sitzung fehl ("Failed to fetch"). Das Backend fährt gerade wieder hoch. Solange es nicht läuft, kann keine Analyse funktionieren.
2. **Die KI entscheidet alles allein** – sie liest die Positionen, erfindet den Vergleichsbereich, rechnet die Abweichung und vergibt die Ampel. Nichts davon wird nachgerechnet. Daher kommen Widersprüche wie "61 % Abweichung, aber im Rahmen".
3. **Zwei verschiedene Regelwerke** – die KI-Anweisung nutzt Grenzen von 20 % / 40 % / -30 %, die Ergebnisseite rechnet mit 15 % / 25 %. Die Ampel hängt also davon ab, welcher Wert zuerst gelesen wird.
4. **Ergebnisseite glaubt dem Text vor der Zahl** – steht im Text irgendwo "regional", wird grün angezeigt, auch wenn die Abweichung hoch ist.
5. **Erfundene Werte** – fehlt eine Menge, wird "1 Stück" eingesetzt; fehlt ein Einzelpreis, wird der Gesamtpreis genommen. Das verfälscht jede Bewertung.
6. **Keine Plausibilitätskontrolle** – es wird nicht geprüft, ob die Summe der Positionen zum Gesamtbetrag passt. Doppelte oder erfundene Positionen fallen deshalb nicht auf.
7. **Excel/CSV wird angenommen, aber als PDF verschickt** – die KI bekommt dann Datenmüll.
8. **Alte Formulierungen** – die KI-Anweisung enthält noch Beispiele wie "Marktpreis für …", obwohl das laut Charta verboten ist.
9. **Viel toter Code** – 6 alte Funktionen (Preis-Normalisierung, Bewertung, PDF-Extraktion, Marktpreis-Suche, Embeddings) werden gar nicht mehr aufgerufen, verwirren aber.
10. **KFZ-Reste** – im Startbereich steht noch "KFZ-Werkstatt", auch im Upload-Fenster und in Server-Funktionen.

## Neuer Ablauf (3 klare Schritte, max. 45 Sekunden)

```text
Upload (PDF/Bild)
   |
   v
Schritt 1: LESEN      KI liest NUR ab, was wirklich dasteht (feste Struktur, keine Bewertung)
   |
   v
Schritt 2: PRÜFEN     Code prüft: Summe passt zum Gesamtbetrag? Doppelte? Menge x Preis stimmt?
   |
   v
Schritt 3: VERGLEICH  KI nennt pro Position nur eine regionale Preis-Spannbreite (min/max)
   |
   v
Ampel                 Code (nicht die KI) berechnet Abweichung + Ampel + Texte nach festen Regeln
```

**Feste Ampel-Regeln (im Code, an einer Stelle, gleich für Server & Anzeige):**
- Einzelpreis innerhalb der Spannbreite oder bis 10 % darüber: **im regionalen Rahmen**
- 10–30 % über der Obergrenze: **leicht über Vergleich**
- mehr als 30 % über der Obergrenze: **auffällig hoch**
- mehr als 25 % unter der Untergrenze: **auffällig niedrig**
- Nur wenn die Position gar keinen Preis hat: **nicht einordenbar**

Jede Position bekommt immer eine Einordnung, sofern sie einen Preis hat (wie von dir gewünscht).

**Texte** werden aus festen, charta-konformen Bausteinen gebaut ("im regionalen Vergleich", "innerhalb der beobachteten Spannbreite vergleichbarer Positionen", Hinweis auf Datenbasis) – die KI schreibt keine Bewertungstexte mehr frei.

## Umsetzung

1. Backend-Status abwarten und prüfen, dass Sitzung + Speichern wieder gehen.
2. Analyse-Funktion komplett neu schreiben (3 Schritte oben, Zeitbudget 45 s, bei Zeitüberschreitung im Vergleichsschritt: KI-Schätzung als Ersatz, klar gekennzeichnet).
3. Ergebnisseite: Ampel nur noch aus dem Server-Ergebnis anzeigen, keine eigene Rechenlogik mehr. Hinweis anzeigen, wenn die Summe nicht zum Gesamtbetrag passt.
4. Upload: nur PDF, JPG, PNG, WEBP erlauben.
5. Alle KFZ-Texte und Icons entfernen.
6. Tote Server-Funktionen löschen, Zwischenspeicher alter Ergebnisse leeren.
7. Automatische Tests für die Ampel-Regeln (je Regel ein Test mit konkreten Zahlen).
8. Selbst testen mit einem echten Beispiel-Angebot (Upload über die Seite), Ergebnis per Screenshot prüfen.

## Technische Details

- `analyze-angebot` neu: Schritt 1 und 3 per Tool-Calling mit striktem JSON-Schema (`google/gemini-2.5-pro` für das Lesen, `google/gemini-2.5-flash` für Spannbreiten, temperature 0). Pflichtfelder `menge`, `einheit`, `einzelpreis` dürfen `null` sein – keine Defaults erfinden.
- Validierung: `|menge*einzelpreis - gesamtpreis| <= 2 %`, Dedupe über normalisierte Beschreibung + Betrag, Summenabgleich netto/brutto mit Toleranz; Ergebnis als `validierung`-Objekt zurückgeben.
- Gemeinsame Bewertungslogik in `supabase/functions/_shared/classify.ts` (Deno-Tests daneben); Frontend nutzt nur `einordnung_stufe` vom Server, `toEvaluationLevel`/`calculateLevelFromDeviation` werden entfernt.
- Löschen: `normalize-position`, `evaluate-price`, `extract-pdf`, `fetch-market-prices`, `generate-embedding`, `seed-embeddings` (Code + Deployment + config.toml-Einträge). `save-guest-analysis`, `generate-pdf-report`, `cleanup-cache` bleiben, KFZ-Zweige darin entfernen.
- Grenzwerte als Konstanten, damit sie leicht anpassbar sind; Entscheidung in `AGENTS.md`, gewählte Prozentwerte im Projektgedächtnis.
