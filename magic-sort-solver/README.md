# Magic Sort Solver

Web-App für **iPhone und iPad** (Safari, optional als Home-Bildschirm-App): Sie liest einen Screenshot eines Sortierspiels wie „Magic Sort!“ ein, erkennt Röhrchen, Kugeln und Farben, löst das Level mit einem echten Suchalgorithmus, **prüft jede Lösung unabhängig** und zeigt die Züge zum Nachspielen an.

Alles läuft lokal im Browser. Es gibt keine Konten, keinen Server und kein Tracking; Screenshots werden nie hochgeladen.

## Schnellstart

Voraussetzung: Node.js 18 oder neuer.

```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Entwicklungsserver (auch im WLAN erreichbar, z. B. http://<Rechner-IP>:5173)
npm test             # Unit- und Integrationstests (Vitest)
npm run typecheck    # TypeScript-Prüfung
npm run build        # Produktionsbuild nach dist/ (inkl. Service Worker)
npm run preview      # Produktionsbuild lokal testen (http://localhost:4173)
npm run test:e2e     # Browser-Tests mit WebKit und iPhone-/iPad-Profilen (Playwright)
```

Für die E2E-Tests einmalig: `npx playwright install webkit`.

## Auf dem iPhone/iPad nutzen

Der **Service Worker (Offline-Betrieb) und die Installation als Web-App brauchen HTTPS**. Der Ordner `dist/` ist eine statische Seite mit relativen Pfaden und lässt sich bei jedem Hoster ablegen (z. B. GitHub Pages, Netlify, Cloudflare Pages, eigener Webserver, auch in einem Unterordner).

Zum Home-Bildschirm hinzufügen (die Installation bestätigst du selbst):

1. Seite in **Safari** öffnen.
2. **Teilen** antippen (Quadrat mit Pfeil; iPhone: unten, iPad: oben).
3. **„Zum Home-Bildschirm“** wählen und **„Hinzufügen“** antippen.

Die App zeigt diese Anleitung selbst an, solange sie nicht als installierte Web-App läuft. Eine ausführliche Bedienungsanleitung steht in [ANLEITUNG.md](ANLEITUNG.md).

## Projektstruktur

```
src/
  solver/        Spiellogik ohne React: types, validatePuzzle, getLegalMoves, applyMove, isSolved,
                 encodeState, solvePuzzle (BFS / gewichtetes A* / IDA*), verifySolution, palette
  vision/        Bilderkennung: detectBalls, detectTubes, classifyColors, reconstructBoard, loadImage
  state/         editor.ts (reine Editor-Funktionen), playback.ts (Schrittlogik, Textliste)
  workers/       solver.worker.ts (Suche im Hintergrund-Thread), protocol.ts
  components/    ImageUploader, PuzzleBoard, TubeView, ColorPalette, EditorToolbar, ValidationPanel,
                 MoveCard, SolutionPlayer, SettingsPanel, InstallHint, StatusBanner
  hooks/         useSolver.ts (Worker-Steuerung, Fortschritt, Abbruch)
  fixtures/      exampleLevel.ts (Testzustand, unabhängig von der Bilderkennung)
  tests/         solver, validation, editor, vision
public/          manifest.webmanifest, icons/
pwa/             sw-template.js (wird beim Build zu dist/sw.js)
e2e/             Playwright-Tests (WebKit, iPhone/iPad)
```

## Wie es funktioniert

**Datenmodell.** Jedes Röhrchen speichert seine Kugeln **von unten nach oben** (`balls[0]` ist die unterste Kugel). Farben sind Zahlen-Kennungen (`ColorId`), Anzeigefarben stehen getrennt in der Palette. Intern werden Röhrchen ab 0 gezählt, die Oberfläche zeigt ab 1. Automatisch erkannte und manuell eingegebene Level haben exakt dieselbe Struktur; unsichere Erkennungen sind je Kugel markiert (`uncertain`).

**Zugmodi.** Modus A (Einzelkugel) und Modus B (gleichfarbiger Block, so viele Kugeln wie ins Ziel passen) sind in den Einstellungen wählbar und gelten durchgängig für Suche, Prüfung und Wiedergabe. Zielbedingung: „jede Farbe in genau einem Röhrchen“ (Standard, entspricht dem Spiel) oder „jedes Röhrchen leer oder einfarbig“.

**Solver.**
- *Breitensuche:* vollständig, liefert die kürzeste Lösung und kann Unlösbarkeit beweisen.
- *Gewichtetes A\*:* findet schnell eine Lösung, die nicht unbedingt die kürzeste ist.
- *IDA\*:* speicherschonend und optimal, mit zulässiger und konsistenter Heuristik (jede Kugel bzw. jeder Farbblock oberhalb des einfarbigen Bodenblocks muss mindestens einmal bewegt werden).
- *Automatisch:* erst Breitensuche, dann gewichtetes A\*, zuletzt IDA\*.
- Doppelte Zustände werden über einen symmetrie-reduzierten Schlüssel erkannt (Röhrchen gleicher Kapazität sind austauschbar). Die Züge behalten die echten Röhrchennummern. Zwischenzüge werden nicht pauschal ausgeschlossen.
- Die Oberfläche meldet „kürzeste Lösung garantiert“ nur nach BFS/IDA\*. „Unlösbar“ wird nur nach vollständiger Suche gemeldet; bei Zeit-, Zustands- oder Nutzerabbruch erscheint „Suche abgebrochen oder Grenze erreicht“.
- Die Suche läuft in einem Web Worker. Abbrechen beendet den Worker.

**Verifizierung.** `verifySolution` ist bewusst unabhängig vom Solver und von `applyMove` implementiert. Sie spielt die Lösung vom gespeicherten Ausgangszustand aus Zug für Zug nach (Quelle/Ziel, Farbe, Kapazität, Anzahl gemäß Modus, Kugelerhaltung, Endzustand). Bei einem Fehler wird die Lösung verworfen und der Fehler angezeigt.

**Bilderkennung** (rein lokal, ohne Bibliothek):
1. Hintergrund je Bildzeile aus den Randspalten schätzen; gesättigte Pixel, die sich davon abheben, bilden die Vordergrundmaske (Lücken durch Glanzlichter werden gefüllt). Mehrere Schwellen werden probiert, der stimmigste Versuch gewinnt.
2. Zusammenhängende Komponenten ergeben Kugeln; der Durchmesser ergibt sich aus der häufigsten Breite. Gestapelte, sich berührende Kugeln werden in einzelne Kugeln zerlegt.
3. Kugeln werden zu Röhrchen (Spalten und Lücken) und Reihen (gemeinsame Bodenlinie) geordnet; Nummerierung links → rechts, dann oben → unten. Leere Röhrchen werden aus Rasterlücken und der Zentrierung abgeleitet und als unsicher gekennzeichnet.
4. Je Kugel wird die Medianfarbe der inneren Fläche (ohne Glanz/Schatten) gemessen, im Lab-Raum geclustert (Farbton zählt stärker als Helligkeit) und mit uneindeutigen Fällen als „unsicher“ markiert.

## Was geprüft wurde – und was nicht

Ehrlicher Stand zum Zeitpunkt der Auslieferung:

| Bereich | Stand |
| --- | --- |
| Spiellogik, Solver, Verifizierung, Validierung, Editor, Wiedergabelogik | 43 automatische Tests laufen durch (Einzelkugel- und Blockmodus, Beispiel mit 10 Röhrchen, Zufallslevel, Abbruch und Grenzen) |
| Bilderkennung | Getestet an **synthetisch gezeichneten** Screenshots (inkl. ähnlicher Farben, leerer Röhrchen innen und am Rand, getönter Glasröhrchen) |
| Oberfläche | In Chromium mit Touch-Emulation geprüft (iPhone SE/14, schmal 320 px, iPad hoch/quer): kein horizontales Scrollen, Touch-Ziele ≥ 44 px, Laden/Lösen/Schrittsteuerung/Wiedergabe/Kopieren/Import/Editor funktionieren |
| **Nicht geprüft** | echte Safari-Engine (WebKit), echtes iPhone/iPad, Safe Areas und Browserleisten-Verhalten auf echter Hardware, Installation als Web-App und Offline-Start (dafür liegen E2E-Tests in `e2e/`, die mit WebKit laufen müssen), `vite build` und das erzeugte `sw.js` |
| **Nicht geprüft** | Bilderkennung an echten „Magic Sort!“-Screenshots. Beim Erstellen lag kein Screenshot vor. `src/fixtures/exampleLevel.ts` hat die beschriebene Struktur (10 Röhrchen, Kapazität 4, 8 Farben à 4, 2 leer), aber eine **erfundene** Belegung. Ersetze sie durch den manuell geprüften Zustand deines Screenshots |

Die Erkennungsschwellen stehen in `src/vision/types.ts`. Wenn echte Screenshots schlecht erkannt werden, sind das die ersten Stellschrauben. Die manuelle Korrektur bleibt in jedem Fall nutzbar.

## Manuelle Tests auf dem Gerät (Checkliste)

1. Build auf einen HTTPS-Host legen und in Safari öffnen (iPhone und iPad).
2. Screenshot aus der Fotomediathek und aus der Dateien-App wählen; Vorschau und erneutes Auswählen prüfen.
3. Analyse starten, Ergebnis mit dem Spiel vergleichen, Fehler per Tippen korrigieren.
4. Lösen, Schrittsteuerung und Wiedergabe testen; Hoch- und Querformat; iPad Split View.
5. Safe Areas prüfen: Tab-Leiste darf nicht unter dem Home-Indikator liegen, Inhalt nicht unter der Statusleiste.
6. Zum Home-Bildschirm hinzufügen, App starten, Flugmodus an, App erneut starten, Level laden und lösen.

## Bekannte Grenzen

- Leere Röhrchen am Rand sind nur über Zentrierung zu erahnen. Die App markiert sie als unsicher; bitte Anzahl prüfen.
- Die Kapazität wird aus dem am höchsten gefüllten Röhrchen abgeleitet.
- Die Zentrierungs-Annahme für Randröhrchen passt nicht, wenn eine Reihe im Spiel links ausgerichtet ist. Dann ergänzt die App ggf. ein leeres Röhrchen zu viel (orange markiert); es lässt sich mit „− Röhrchen“ entfernen.
- Sehr große Level können Zeit- oder Speichergrenzen erreichen. Dann erscheint „Suche abgebrochen oder Grenze erreicht“; in den Einstellungen lassen sich die Grenzen erhöhen.
- HEIC-Fotos wandelt iOS bei der Auswahl meist selbst in JPEG um. Für Screenshots (PNG) ist das unkritisch.
