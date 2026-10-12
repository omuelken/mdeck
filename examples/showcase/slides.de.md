---
theme: neue
meta:
  title: "Eine Tour durch mdeck"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-10-06"
bibliography: refs.bib
---

---
:::meta
layout: title
image: ./img/mdeck.svg
fit: contain
alt: "Eine Markdown-Datei wird zu einem Stapel Folien"
id: a-talk-in-a-text-file
time: 1m
:::
# Ein Vortrag in einer Textdatei.
## Eine Tour durch mdeck: Jede Folie zeigt, *was geschrieben steht* und was daraus wird.

:::notes
Dieses Deck erklärt mdeck an Beispielen. Die meisten Folien zeigen das Markdown neben dem, was daraus wird. Öffne `slides.de.md` daneben: Jede Folie hier ist genau so geschrieben, wie sie gezeigt wird.

Blättere mit den Pfeiltasten oder der Leertaste. Diese Notizen sind nur für dich; öffne die Referentenansicht über die Startseite, um sie neben der Folie zu sehen.

Die Tour gibt es auch auf Englisch (`slides.en.md`) und Arabisch (`slides.ar.md`). Starte sie mit `mdeck run slides.en.md`; **L** in der Referentenansicht schaltet alle Fenster auf die nächste Sprache.
:::

---
:::meta
layout: chapter
number: 1
part: Schreiben
description: Einfaches Markdown, das Format, das KI-Assistenten ohnehin schreiben. Du kannst jedes Wort lesen und ändern.
time: 15s
:::
# Schreiben.

:::notes
In der Praxis schreibt meist ein KI-Assistent diese Datei aus deinem eigenen Material: alten Folien, einem Dokument, deinen Notizen. Der Skill `write-slides` bringt ihm mdeck bei. Die nächsten Folien zeigen, was er schreibt, damit du es lesen und anpassen kannst.
:::

---
:::meta
layout: split
time: 1m
:::
# Aus Worten werden Folien
:::slot left
```markdown
# Unser nächstes Abenteuer

Ein Absatz ganz normaler Text.

---

# Die nächste Idee
```
:::
:::slot right
## Unser nächstes Abenteuer

Ein Absatz ganz normaler Text.

Drei Striche auf einer eigenen Zeile beginnen die nächste Folie.
:::

:::notes
`#` ist die Überschrift der Folie. Eine Leerzeile trennt Absätze.

Probier es aus: Ändere eine Überschrift in `slides.de.md` und speichere. Die Folie aktualisiert sich, während sie offen ist.
:::

---
:::meta
layout: split
time: 45s
:::
# Listen und Hervorhebung
:::slot left
```markdown
- Bring ein Notizbuch mit.
- Stell **eine gute Frage**.
- Teile, was *du* lernst.

1. Zuhören
2. Zusammenfassen
```
:::
:::slot right
- Bring ein Notizbuch mit.
- Stell **eine gute Frage**.
- Teile, was *du* lernst.

1. Zuhören
2. Zusammenfassen
:::

:::notes
`**fett**` und `*hervorgehoben*`; wie Hervorhebung aussieht, entscheidet das Theme. Hier bekommt sie die Akzentfarbe.
:::

---
:::meta
time: 1m
:::
# Punkte einzeln aufdecken

:::columns
```markdown
:::steps
- Zuerst eine Frage.
- Dann eine Pause.
- Dann die Antwort.
:::
```
+++
:::steps
- Zuerst eine Frage.
- Dann eine Pause.
- Dann die Antwort.
:::
:::

:::notes
Drück die Weiter-Taste: Jeder Druck deckt einen Punkt auf, danach geht es weiter. Gedruckte Folien und das PDF zeigen alle Punkte.

Diese Folie hat kein Layout: `:::columns` stellt Quelltext und Ergebnis nebeneinander, `+++` beginnt die zweite Spalte.
:::

---
:::meta
layout: chapter
number: 2
part: Layouts und Inhalte
description: Layouts, Bilder, Code, Tabellen und Hinweiskästen. Wähle pro Folie ein Layout; den Rest erledigt das Theme.
time: 15s
:::
# Gestalten.

---
:::meta
layout: split
props:
  ratio: [3, 2]
time: 1m
:::
# Ein Layout wählen
:::slot left
```markdown
:::meta
layout: focus
attribution: "Eine Lehrerin"
:::
# Gute Fragen führen
# zu besseren Gesprächen.
```
:::
:::slot right
Ein `:::meta`-Block oben auf der Folie enthält ihre Einstellungen.

`layout: focus` macht eine grosse Aussage. Die nächste Folie ist genau diese.
:::

:::notes
Ohne Layout ist eine Folie eine gewöhnliche Überschrift mit Inhalt. Diese Folie ist `layout: split`, die beiden Seiten stehen in `:::slot left` und `:::slot right`; `ratio: [3, 2]` gibt dem Code mehr Platz.

Die eingebauten Layouts sind `title`, `chapter`, `focus`, `split`, `image-text` und `full-bleed-image`.
:::

---
:::meta
layout: focus
attribution: "Eine Lehrerin"
time: 30s
:::
# Gute Fragen führen zu besseren Gesprächen.

---
:::meta
layout: image-text
image: ./img/image.jpg
alt: "Höhenlinien wie auf einer Landkarte"
time: 45s
:::
# Ein Bild neben deinen Worten

```markdown
:::meta
layout: image-text
image: ./img/image.jpg
alt: "Höhenlinien"
:::
```

`alt` beschreibt das Bild für Menschen, die es nicht sehen können.

:::notes
Bilder liegen am besten in einem Ordner neben den Folien, hier `img/`. Die nächste Folie zeigt dasselbe Bild mit `layout: full-bleed-image`.
:::

---
:::meta
layout: full-bleed-image
image: ./img/image.jpg
alt: "Höhenlinien wie auf einer Landkarte"
overlay: true
time: 30s
:::
# Oder das Bild füllt die ganze Folie.

:::notes
Diese Folie ist so geschrieben:

```markdown
:::meta
layout: full-bleed-image
image: ./img/image.jpg
overlay: true
:::
# Oder das Bild füllt die ganze Folie.
```

`overlay: true` dunkelt das Bild ab, damit die Überschrift lesbar bleibt.
:::

---
:::meta
layout: split
time: 1m30s
:::
# Code, der läuft
:::slot left
````markdown
```python live editable
squares = [x**2 for x in range(1, 6)]
print(squares)
```
````
:::
:::slot right
```python live editable
squares = [x**2 for x in range(1, 6)]
print(squares)
```
:::

:::notes
Drück auf Run. `live` fügt den Knopf hinzu, mit `editable` lässt sich der Code während des Vortrags ändern, `copy` fügt einen Kopierknopf hinzu. JavaScript funktioniert genauso.

Live-Python lädt seine Laufzeitumgebung beim ersten Mal herunter und braucht dafür eine Internetverbindung.
:::

---
:::meta
layout: split
time: 45s
:::
# Tabellen und Formeln
:::slot left
```markdown
| Ebene | Wem sie gehört |
|---|---|
| Worte | Dir |
| Aussehen | Dem Theme |

$$
A = \pi r^2
$$
```
:::
:::slot right
| Ebene | Wem sie gehört |
|---|---|
| Worte | Dir |
| Aussehen | Dem Theme |

$$
A = \pi r^2
$$
:::

:::notes
Formeln werden in LaTeX geschrieben. Einfache Dollarzeichen setzen eine Formel in einen Satz; doppelte Dollarzeichen darüber und darunter stellen sie auf eine eigene Zeile.
:::

---
:::meta
layout: split
time: 45s
:::
# Tipps und Warnungen
:::slot left
```markdown
:::tip
Ein Tipp pro Folie reicht.
:::

:::warning
Prüf den Beamer im Raum.
:::
```
:::
:::slot right
:::tip
Ein Tipp pro Folie reicht.
:::

:::warning
Prüf den Beamer im Raum.
:::
:::

:::notes
Die übrigen Hinweiskästen sind `note`, `important` und `caution`. Eine eigene Beschriftung kommt hinter den Typ, zum Beispiel `:::tip Vor dem Vortrag`.
:::

---
:::meta
layout: split
time: 1m
:::
# Quellen zitieren
:::slot left
```markdown
---
bibliography: refs.bib
---

Abrufen schlägt Wiederlesen
[@roediger2006].
```
:::
:::slot right
Abrufen schlägt Wiederlesen [@roediger2006].

Vorlesungen mit aktivem Lernen senken die Durchfallquote um ein Drittel [@freeman2014].
:::

:::notes
`refs.bib` ist eine BibTeX-Datei, wie Zotero sie exportiert; CSL-JSON und Hayagriva gehen auch. Jede Folie führt ihre eigenen Quellen über der Fusszeile auf, und `<bibliography />` auf einer Folie listet alle auf. `csl: vancouver` stellt auf Nummern um.
:::

---
:::meta
layout: chapter
number: 3
part: Präsentieren
description: Notizen für dich, Zeichnen auf den Folien und Fragen an den Raum.
id: give-the-talk
time: 15s
:::
# Vortragen.

---
:::meta
layout: split
time: 1m
:::
# Notizen nur für dich
:::slot left
```markdown
:::notes
Hier Pause. Fragen, wer das
schon ausprobiert hat.
:::
```
:::
:::slot right
Notizen stehen unter dem Inhalt der Folie. Sie erscheinen in der **Referentenansicht**, nie auf dem Beamer.

Öffne sie über die Startseite und zieh das **Publikumsfenster** auf den Beamer. Die beiden folgen einander.
:::

:::notes
Hier Pause. Fragen, wer das schon ausprobiert hat.

So zeigt die Referentenansicht diese Folie. Ihre Kopfzeile zeigt auch, was verbunden ist: weitere Referentenansichten, Publikumsfenster und Handys.
:::

---
:::meta
id: draw-on-any-slide
time: 1m
:::
# Auf jeder Folie zeichnen

Drück jetzt **D** oder den Stift-Knopf. Zeichne mit Stift, Textmarker oder einem Marker, der nach einem Moment verblasst. **Escape** beendet das Zeichnen.

Zeichnungen landen in einer `.drawings.json`-Datei neben den Folien und erscheinen im PDF.

:::notes
Unterstreichung und Kreis auf dieser Folie wurden mit dem Stift gezeichnet und gespeichert; sie erscheinen in jeder Ansicht und im PDF.

Ein iPad koppelst du über die Startseite: Dort zeichnest und steuerst du, während der Laptop den Beamer bedient.
:::

---
:::meta
layout: split
hotspots: auto
id: zoom-in-on-a-part
time: 1m30s
:::
# In einen Teil hineinzoomen
:::slot left
```markdown
:::meta
hotspots: auto
:::
```

Drück in der Referentenansicht eine **Zahl**, um in diesen Teil zu zoomen. Dieselbe Zahl, **0** oder **Escape** führt zurück.
:::
:::slot right
| Ebene | Wem sie gehört |
|---|---|
| Worte | Dir |
| Aussehen | Dem Theme |

$$
A = \pi r^2
$$
:::

:::notes
Die Zifferntasten erscheinen auf dieser Folie nur hier in der Referentenansicht, nie auf dem Beamer. Drück 2 für die Tabelle, 3 für die Formel; das Publikumsfenster fliegt mit. Die Pfeiltasten verlassen den Zoom und blättern mit einem Druck weiter.

`hotspots: auto` findet Bilder, Code, Tabellen, Formeln und Hinweiskästen. In den Deck-Einstellungen ganz oben gibt es Tasten auf jeder Folie; `marked` vergibt Tasten nur an Teile mit `data-hotspot`. H schaltet die Tasten während des Vortrags aus und ein.
:::

---
:::meta
layout: split
time: 1m
:::
# Den Vortrag timen
:::slot left
```markdown
:::meta
time: 1m
:::
```
:::
:::slot right
Gib jeder Folie eine **Zeit**. Die Referentenansicht zählt sie herunter und zeigt, ob du vor oder hinter dem Plan liegst.

Mit `mdeck rehearse slides.md` misst du die Folien beim Üben und speicherst die Zeiten in der Datei.
:::

:::notes
Jede Folie dieser Tour hat eine Zeit, insgesamt 21 Minuten. Drück T in der Referentenansicht, um den Timer zu starten: Darunter siehst du, wie viel von dieser Folie übrig ist und wo der Vortrag steht.

Eine Probe misst die Zeiten für dich. Am Ende bietet sie sie auf 15 Sekunden gerundet an; ändere beliebige davon, bevor du speicherst.
:::

---
:::meta
time: 1m30s
:::
# Was probierst du zuerst aus?

<poll room="tour" options="Schreiben|Layouts|Zeichnen|Umfragen" />

:::notes
Eine Zeile ergibt eine Umfrage; die Überschrift ist die Frage:

`<poll room="tour" options="Schreiben|Layouts|Zeichnen|Umfragen" />`

Handys kommen über den QR-Code dazu. Sie erreichen diesen Computer, wenn du `mdeck run slides.md --network` startest.
:::

---
:::meta
layout: split
time: 1m
:::
# Ein Wort von allen
:::slot left
```markdown
<wordcloud room="mood"
  qr="false" />

<scale room="pace" min="1" max="5"
  low="Zu langsam" high="Zu schnell" />

<question room="ask" />
```
:::
:::slot right
<wordcloud room="mood" placeholder="Ein Wort" qr="false" />
:::

:::notes
Handys, die mit dem Code der Umfrage beigetreten sind, bleiben dabei: `qr="false"` lässt den Code hier weg. Antworten erscheinen, sobald sie eintreffen.

Neben Umfragen und Wortwolken gibt es Bewertungen (`<scale>`), Zahlen mit richtiger Antwort (`<numeric>`) und offene Fragen (`<question>`). Bei mehreren davon zeigt `<qrcode join />` auf einer frühen Folie den Code einmal. `mdeck run` speichert die Antworten in `slides.results.json` neben dem Deck.
:::

---
:::meta
layout: chapter
number: 4
part: Teilen
description: Eine Datei zum Verschicken, ein PDF oder ein Ordner für eine Website.
time: 15s
:::
# Teilen.

---
:::meta
layout: split
time: 45s
:::
# Das ganze Aussehen ändern
:::slot left
```markdown
---
theme: work
palette: lagoon
---
```
:::
:::slot right
Zwei Zeilen am Anfang der Datei wählen Theme und Farben für alle Folien auf einmal.

Zum Ausprobieren, ohne die Datei zu ändern: die **Leseansicht** öffnen und **Look** wählen.
:::

:::notes
mdeck hat vier eingebaute Themes und fünf Paletten, jeweils hell oder dunkel. `mdeck list` zeigt sie alle, auch solche in einem Ordner `extensions` neben dem Deck. `mdeck themes search` findet weitere im Theme-Repository.
:::

---
:::meta
layout: split
time: 45s
:::
# Verschicken, drucken, hosten
:::slot left
```sh
mdeck send slides.md
mdeck pdf slides.md
mdeck build slides.md
```
:::
:::slot right
`send` erzeugt eine HTML-Datei ohne deine Notizen, mit einem PDF darin. Man öffnet sie im Browser.

`pdf` erzeugt eine Seite pro Folie. `build` erzeugt einen Ordner für einen Webserver.
:::

---
:::meta
layout: title
time: 1m
:::
# Jetzt bist du dran.
## Gib deine Folien, Dokumente oder Notizen einem *KI-Assistenten*.

:::notes
`mdeck skill --install claude` (oder codex, cursor, copilot, gemini) installiert den Skill `write-slides`, der dem Assistenten mdeck beibringt. Dann verweist du ihn auf dein Material: „Bau lecture-03.pptx als 20-minütigen Vortrag neu.“

Ohne Assistent stellt `mdeck new` ein paar Fragen und legt ein Deck an.
:::
