# Bedienungsanleitung – Magic Sort Solver

## Das Wichtigste in drei Schritten

1. **Screenshot auswählen** und **analysieren** – oder **Level manuell eingeben**.
2. Das erkannte Spielfeld **prüfen und korrigieren**.
3. **Level lösen** – danach die Lösung Schritt für Schritt nachspielen.

## Vorab: Regeln einstellen

Unter **Einstellungen → Spielregeln** wählst du, wie dein Spiel funktioniert:

- **Modus A – Einzelkugel:** pro Zug wird genau eine Kugel bewegt.
- **Modus B – Gleichfarbiger Block:** pro Zug werden so viele zusammenhängende gleichfarbige Kugeln von oben bewegt, wie ins Zielröhrchen passen.
- **Zielbedingung:** „Jede Farbe in genau einem Röhrchen“ entspricht dem Spiel. „Leer oder einfarbig“ ist lockerer.

Die Lösung gilt nur für die Regeln, mit denen sie berechnet wurde. Ändern sich die Regeln, wird sie verworfen.

## 1. Screenshot importieren

- **Screenshot auswählen** öffnet die Fotos- oder Dateien-App. PNG und JPEG funktionieren am besten.
- Die Vorschau erscheint sofort. Mit **Anderen Screenshot auswählen** kannst du jederzeit tauschen.
- **Screenshot analysieren** erkennt Röhrchen, Kugeln und Farben. Nach der Analyse siehst du auf dem Bild Kreise an den erkannten Kugeln und die Röhrchennummern. **Orange gestrichelte** Kreise und „?“ bedeuten: unsicher.
- Das Bild bleibt auf deinem Gerät.

Schlägt die Erkennung fehl, bleibt dein bisheriges Spielfeld unverändert. Gib das Level dann von Hand ein.

## 2. Spielfeld prüfen und korrigieren

Die Röhrchen sind von **links nach rechts, dann von oben nach unten** ab **1** nummiert. Kugeln liegen im Röhrchen wie im Spiel: Die erste Kugel liegt **unten**, neue Kugeln werden **oben** eingefügt.

**Farbe wählen:** Tippe in der Palette auf eine Farbe.

**Modus wählen:**

| Modus | Antippen einer Kugel | Antippen eines Röhrchens / leeren Platzes |
| --- | --- | --- |
| Ändern | Kugel bekommt die gewählte Farbe | fügt oben eine Kugel ein |
| Hinzufügen | fügt oben eine Kugel ein | fügt oben eine Kugel ein |
| Entfernen | entfernt diese Kugel | entfernt die oberste Kugel |
| Verschieben | wählt die Quelle bzw. das Ziel | zuerst Quelle, dann Ziel: die oberste Kugel wandert |

**Röhrchen bearbeiten:** Tippe auf die **Nummer** eines Röhrchens, um es zu markieren (gelb). Dann wirken **− Röhrchen**, **Leeren** und die **Kapazität** (± neben „Kapazität“) auf dieses Röhrchen. Ohne Markierung gilt die Kapazität für alle Röhrchen. **＋ Röhrchen** hängt ein leeres Röhrchen an. **↶ Rückgängig** nimmt die letzte Änderung zurück. **Level komplett zurücksetzen** legt ein leeres Level an.

**Die Prüfung** unter dem Spielfeld unterscheidet:

- **Ungültiger Zustand** (rot): z. B. überfülltes Röhrchen oder mehr Farben als Röhrchen. So kann nicht gelöst werden.
- **Unsichere Erkennung** (orange): Kugeln, deren Farbe nicht eindeutig war. Tippe sie an und wähle die richtige Farbe. Die Markierung verschwindet, sobald du die Kugel bearbeitest.
- **Hinweise:** z. B. unterschiedlich viele Kugeln je Farbe. Das deutet auf eine fehlende oder doppelt erfasste Kugel hin.

Die App korrigiert nie stillschweigend und erfindet keine Kugeln.

## 3. Lösen

**Level lösen** startet die Suche im Hintergrund. Du siehst Fortschritt und Zeit und kannst mit **Abbrechen** stoppen. Mögliche Ergebnisse:

- **Lösung gefunden und geprüft:** Die Lösung wurde unabhängig Zug für Zug nachgespielt. Erst dann wird sie angezeigt. „Kürzeste Lösung garantiert“ steht nur dort, wo der Algorithmus das tatsächlich beweist.
- **Das Level ist unlösbar:** Die vollständige Suche fand nichts. Meist steckt ein Eingabe- oder Erkennungsfehler dahinter.
- **Suche abgebrochen oder Grenze erreicht:** Das heißt *nicht*, dass das Level unlösbar ist. Erhöhe in den Einstellungen die Zeit- oder Zustandsgrenze oder wähle ein anderes Verfahren.
- **Interner Fehler:** Wird eine berechnete Lösung von der Prüfung verworfen, siehst du den Fehler statt einer falschen Zugfolge.

## Lösung nachspielen

Im Tab **Lösung**:

- **⏮ / ◀ / ▶ / ⏭:** erster, vorheriger, nächster, letzter Zug.
- **Abspielen / Pause** und **Geschwindigkeit** (0,5× bis 4×).
- **Von** (orange) und **Nach** (grün) markieren Quelle und Ziel des aktuellen Zuges, zusätzlich als Text.
- **Kompakte Zugliste:** eine Zeile pro Zug, z. B. `4. 6 → 9 (Orange ×2)`. Mit **Zugliste kopieren** legst du sie in die Zwischenablage.
- **Alle Züge** gibt es als Karten (mit Miniaturansicht des Zustands nach dem Zug) oder als Tabelle. Tippe eine Karte oder Zugnummer an, um zu diesem Zug zu springen.
- **Technische Details** zeigen Verfahren, untersuchte Zustände und Rechenzeit.

## Einstellungen

- **Suche:** Verfahren, Zustandsgrenze (Arbeitsspeicher) und höchste Suchzeit.
- **Datenschutz:** „Letztes Spielfeld merken“ speichert nur Spielfeld und Palette lokal auf dem Gerät, nie den Screenshot. **Gespeicherte Daten löschen** entfernt alles.
- **Installation:** Anleitung für den Home-Bildschirm.

## Zum Home-Bildschirm hinzufügen (iPhone und iPad)

1. In **Safari** öffnen (nicht in einer anderen App-internen Ansicht).
2. **Teilen** antippen: iPhone unten in der Leiste, iPad oben rechts.
3. **„Zum Home-Bildschirm“** wählen, Namen bestätigen, **„Hinzufügen“** antippen.

Die App installiert sich nie von selbst; du bestätigst das Hinzufügen. Nach dem ersten erfolgreichen Laden (über HTTPS) startet sie auch ohne Internet.

## Tipps bei schlechter Erkennung

- Ein vollständiger Screenshot des Spielfelds ohne eingeblendete Dialoge erkennt sich am besten.
- Prüfe die Anzahl der Röhrchen, besonders **leere Röhrchen am Rand**.
- Prüfe die **Kapazität**: Sie wird aus dem am höchsten gefüllten Röhrchen abgeleitet.
- Ähnliche Farben (Rot/Orange, Blau/Türkis, Pink/Lila) werden bei Unsicherheit orange markiert. Vergleiche sie mit dem Spiel.
