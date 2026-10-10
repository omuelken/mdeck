---
theme: academic
meta:
  title: "Einführung in Python"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-05-19"
palette: paper
---

---
:::meta
layout: title
id: python-for-life-sciences
:::
# Python für die Life Sciences.
## Eine Einführung Schritt für Schritt für Masterstudierende.

:::notes
Willkommen zum Python-Modul. Diese Sitzung setzt keine Programmiererfahrung voraus.

- Wir gehen Schritt für Schritt vor – unterbrecht mich ruhig mit Fragen
- Aller Code läuft live im Browser – heute muss nichts installiert werden
- Ziel: am Ende könnt ihr einen Datensatz laden, ansehen und plotten
:::

---
:::meta
layout: focus
eyebrow: Warum Python?
id: the-tools-your-field-uses-are-written-in
:::
# Die Werkzeuge eures Fachs sind *in Python geschrieben*.

:::notes
Python ist die führende Sprache für datenintensive Arbeit, in der Forschung wie in der Industrie.
Die Life Sciences sind keine Ausnahme – Bioinformatik, Bildanalyse und klinische Daten laufen alle mit Python.

Das Ökosystem (NumPy, Pandas, Matplotlib, scikit-learn, BioPython) ist unerreicht.
Erwähnen, dass R in der Statistik noch verbreitet ist, Python sich aber weitgehend als gemeinsame Sprache durchgesetzt hat.
:::

---
:::meta
layout: chapter
number: 1
part: Erste Schritte
description: Variablen, Typen und die ersten Zeilen Code.
id: variables-and-data-types
:::
# Variablen und Datentypen.

:::notes
Hier anfangen, auch wenn einige schon etwas Python gesehen haben. Wir bauen von Grund auf auf.
Geschätzte Zeit für dieses Kapitel: 20 Minuten.
:::

---
:::meta
layout: split
section: Variablen
id: variables-store-data
props:
  ratio: [3, 2]
:::
# Eine Variable ist ein Name für einen Wert.
:::slot left
```python live editable copy
name = "E. coli"
genome_size = 4_641_652   # Basenpaare
gc_content = 0.506        # Anteil

print(name, genome_size, gc_content)
print(f"GC content: {gc_content:.1%}")
```
:::
:::slot right
Keine Deklarationen: Python erkennt den Typ am Wert.

**Probiert es aus:** setzt `gc_content` auf `0.65` und führt den Code erneut aus.
:::

:::notes
Eine Variable ist nur ein Name, der an einem Wert hängt. Den Typ bestimmt Python selbst.

Hinweisen: keine Strichpunkte, keine Typdeklarationen, kein Drumherum. Der String `f"…"` setzt einen Wert in einen Text ein; `:.1%` zeigt einen Anteil als Prozentzahl.
Die Studierenden ermutigen, die Werte zu ändern und neu auszuführen – genau dafür ist der Live-Block da.
:::

---
:::meta
section: Datentypen
id: four-types-cover-most-biology-data
:::
# Vier Typen decken die meisten biologischen Daten ab.

:::steps
- **`int`** – ganze Zahlen: Anzahlen, Positionen, Indizes
- **`float`** – Dezimalzahlen: Konzentrationen, p-Werte, Fold Changes
- **`str`** – Text: Gennamen, Sequenzen, Proben-IDs
- **`bool`** – True oder False: Signifikanz-Flags, Qualitätsfilter
:::

:::notes
Einen Typ nach dem anderen aufdecken und vor dem nächsten nach einem Beispiel aus dem Labor fragen.

Betonen, dass Booleans meist aus Vergleichen entstehen, nicht aus einem geschriebenen True/False. Die nächste Folie fragt den Raum.
:::

---
:::meta
section: Datentypen
title: "Umfrage: der Typ eines p-Werts"
id: poll-the-type-of-a-p-value
:::
# Welchen Typ hat ein p-Wert?

<poll room="p-value" options="int|float|str|bool" answer="float" />

:::notes
Eine kurze Kontrolle, bevor es weitergeht. Die Handys kommen über den QR-Code dazu; startet das Deck mit `mdeck run slides.de.md --network`, damit sie diesen Computer erreichen.

Antwort: `float`; der Haken-Knopf unter den Balken markiert sie. Wenn viele `bool` gewählt haben, denken sie an das *Signifikanz-Flag*, das daraus berechnet wird (`p < 0.05`): ein guter Moment, um zu zeigen, dass Vergleiche Booleans ergeben.
:::

---
:::meta
layout: split
section: Strings
props:
  ratio: [3, 2]
:::
# Strings verhalten sich wie Sequenzen.
:::slot left
```python live editable copy
dna = "ATGCGTAAGCTTGAC"

print("Length:     ", len(dna))
print("First codon:", dna[:3])
print("A count:    ", dna.count("A"))
print("Reversed:   ", dna[::-1])
print("As RNA:     ", dna.replace("T", "U"))
```
:::
:::slot right
Ausschneiden, Zählen und Ersetzen funktioniert bei jedem Text gleich.

**Probiert es aus:** gebt das letzte Codon mit `dna[-3:]` aus.
:::

:::notes
Strings sind Sequenzen – man kann sie ausschneiden wie eine Nukleotidsequenz.
`replace("T", "U")` ist Transkription in einer Zeile. Die Begriffe lassen sich später direkt auf BioPython übertragen.
:::

---
:::meta
layout: chapter
number: 2
part: Sammlungen
description: Mehrere Werte auf einmal speichern und abrufen.
:::
# Listen und Dictionaries.

:::notes
Die meisten echten Daten sind kein einzelner Wert. Listen und Dictionaries sind die beiden Arbeitspferde unter den Sammlungen.
Geschätzte Zeit für dieses Kapitel: 25 Minuten.
:::

---
:::meta
layout: split
section: Listen
props:
  ratio: [3, 2]
:::
# Eine Liste hält Werte in einer Reihenfolge.
:::slot left
```python live editable copy
conc = [0.12, 0.45, 0.33, 0.78, 0.21]

print("Samples:", len(conc))
print("First:  ", conc[0])
print("Last:   ", conc[-1])
print("Sorted: ", sorted(conc))
print("Mean:   ", sum(conc) / len(conc))
```
:::
:::slot right
Gezählt wird ab null: `conc[0]` ist das erste Element, `conc[-1]` das letzte.

**Probiert es aus:** fügt einen sechsten Wert hinzu und seht, wie sich der Mittelwert ändert.
:::

:::notes
Listen behalten die Reihenfolge und erlauben Duplikate. Der Index beginnt bei 0. Negative Indizes zählen vom Ende.
Gut für: Zeitreihen, Replikat-Messungen, geordnete Verarbeitungsschritte.

Häufiger Fehler: Studierende nehmen Index 1 für das erste Element. Die Zählung ab 0 früh einüben.
:::

---
:::meta
layout: split
section: Dictionaries
props:
  ratio: [3, 2]
:::
# Ein Dictionary sucht Werte über einen Namen.
:::slot left
```python live editable copy
sample = {
    "id": "S042",
    "organism": "Mus musculus",
    "tissue": "liver",
    "weight_mg": 312,
}

print(sample["organism"])
sample["weight_mg"] = 318   # ein Feld ändern
print(sample)
```
:::
:::slot right
Ein Dictionary beschreibt eine Probe: keine Spaltennummern zum Merken.

**Probiert es aus:** fügt `"treated": True` hinzu.
:::

:::notes
Dictionaries ordnen Schlüsseln Werte zu. Ideal für strukturierte Datensätze – ein Dictionary = eine Probe.
Später wird aus einer Liste von Dictionaries ein Pandas-DataFrame. Diesen Gedanken jetzt schon säen.
:::

---
:::meta
layout: chapter
number: 3
part: Kontrollfluss
description: Entscheidungen treffen und Arbeitsschritte über die Daten wiederholen.
:::
# Entscheidungen und Schleifen.

:::notes
Diese beiden Konstrukte – if und for – decken den Grossteil der Logik in Datenverarbeitungs-Skripten ab.
Geschätzte Zeit für dieses Kapitel: 25 Minuten.
:::

---
:::meta
layout: split
section: Bedingungen
props:
  ratio: [3, 2]
:::
# `if` wählt einen Weg.
:::slot left
```python live editable copy
p_value = 0.023
fold_change = 2.4

if p_value < 0.05 and fold_change > 2:
    print("Significant upregulation")
elif p_value < 0.05:
    print("Significant, modest effect")
else:
    print("Not significant")
```
:::
:::slot right
Die Einrückung ist der Block: Python verwendet Leerraum, keine geschweiften Klammern.

**Probiert es aus:** setzt `fold_change = 1.5`.
:::

:::notes
if / elif / else deckt jede Verzweigung ab. Einrückung ist in Python kein Stil, sondern Syntax.
Das bringt Leute aus anderen Sprachen oder aus R ins Stolpern. Doppelpunkt und Einrückung sind Pflicht.
Zeigen, was passiert, wenn der Doppelpunkt fehlt: Python meldet einen SyntaxError.
:::

---
:::meta
layout: split
section: Schleifen
props:
  ratio: [3, 2]
:::
# `for` wiederholt einen Schritt für jedes Element.
:::slot left
```python live editable copy
values = [1.2, 0.8, 2.1, 1.5, 0.9, 2.8]

above = []
for value in values:
    if value > 1.0:
        above.append(value)

print(len(above), "of", len(values))
print(above)
```
:::
:::slot right
Durchlaufen, prüfen, sammeln: das Grundmuster beim Filtern von Daten.

**Probiert es aus:** zählt stattdessen die Werte unter 1.0.
:::

:::notes
for-Schleifen laufen über jede Sammlung. Dieses Muster – durchlaufen, prüfen, sammeln – steckt im Kern
fast jedes Datenverarbeitungs-Skripts, das die Studierenden schreiben werden.

**D** drücken und einen Wert auf der Folie durch die Schleife verfolgen: in `value`, durch das `if`, in `above`. Escape beendet das Zeichnen; die Zeichnung bleibt bei der Folie.
:::

---
:::meta
layout: chapter
number: 4
part: Funktionen
description: Logik verpacken, um sie wiederzuverwenden und zu testen.
:::
# Funktionen verpacken Logik zur Wiederverwendung.

:::notes
Funktionen sind der erste Schritt zu wiederverwendbarem, testbarem Code.
Motivieren mit: „Ihr rechnet dasselbe für 200 Proben – einmal schreiben, 200-mal aufrufen.“
Geschätzte Zeit für dieses Kapitel: 20 Minuten.
:::

---
:::meta
layout: split
section: Funktionen
props:
  ratio: [3, 2]
:::
# Eine Funktion macht aus Eingaben ein Ergebnis.
:::slot left
```python live editable copy
def gc_content(seq):
    """Gibt den GC-Anteil einer Sequenz zurück."""
    gc = seq.count("G") + seq.count("C")
    return gc / len(seq)

for seq in ["ATGCGC", "AATTAA", "GCGCGC"]:
    print(seq, f"{gc_content(seq):.0%}")
```
:::
:::slot right
Einmal schreiben, dann für jede Probe aufrufen.

**Probiert es aus:** fügt der Liste eure eigene Sequenz hinzu.
:::

:::notes
def, Parameter, return – das ist die ganze Syntax.
Durchgehen: einmal definieren, viele Male mit verschiedenen Eingaben aufrufen.
Der Docstring (der String in dreifachen Anführungszeichen nach def) ist gute Praxis – früh einführen.
:::

---
:::meta
layout: chapter
number: 5
part: Wissenschaftliches Python
description: NumPy, Pandas und Matplotlib – die drei Säulen.
:::
# Der wissenschaftliche Stack.

:::notes
Diese drei Bibliotheken machen Python zur führenden Sprache in der Datenwissenschaft.
In der Praxis schreiben die Studierenden wenig reines Python – sie verwenden diese Bibliotheken.
Geschätzte Zeit für dieses Kapitel: 30 Minuten.
:::

---
:::meta
section: Wissenschaftliches Python
:::
# Drei Bibliotheken decken die meisten Abläufe in den Life Sciences ab.

:::steps
- **NumPy** – schnelle Arrays: mit einem ganzen Datensatz auf einmal rechnen
- **Pandas** – Tabellen: Tabellendaten laden, filtern, gruppieren und zusammenfassen
- **Matplotlib** – Plots, mit Kontrolle über jedes Element
:::

:::notes
Kurzer Überblick, bevor es in die Tiefe geht. Die Kernbotschaft: Diese Bibliotheken erledigen die Schwerarbeit,
sodass die Studierenden weniger Code schreiben und schneller zu verlässlicheren Ergebnissen kommen als mit reinen Python-Schleifen.
:::

---
:::meta
layout: split
section: NumPy
props:
  ratio: [3, 2]
:::
# NumPy rechnet mit ganzen Arrays.
:::slot left
```python live copy
import numpy as np

m = np.array([1.2, 0.8, 2.1, 1.5, 0.9, 2.8])

print("Mean:  ", m.mean().round(3))
print("Std:   ", m.std().round(3))
print("Median:", np.median(m))
print("> 1.5: ", m[m > 1.5])
```
:::
:::slot right
`m[m > 1.5]` filtert ohne Schleife.

Vergleicht es mit der `for`-Schleife von vor zwei Kapiteln.
:::

:::notes
NumPy-Operationen wirken auf das ganze Array auf einmal – ohne Schleifen. Das ist schneller und lesbarer.
Der vektorisierte Stil braucht Gewöhnung, lohnt sich aber, früh gelernt zu werden.
Demo: Die Studierenden vorhersagen lassen, was `m > 1.5` zurückgibt, bevor der Code läuft.
:::

---
:::meta
layout: focus
eyebrow: Die wichtigste Einsicht
:::
# Rechnet mit *Arrays*, nicht mit einzelnen Werten.

:::notes
Das ist der wichtigste Umbau im Denken von reinem Python zu wissenschaftlichem Python.
Wiederholen und wirken lassen. Wer das früh verinnerlicht, schreibt später viel saubereren Code.
:::

---
:::meta
layout: chapter
number: 6
part: Wie es weitergeht
description: Wohin es von hier aus geht.
id: keep-going
:::
# Dranbleiben.

:::notes
Mit einem Fahrplan schliessen. Nach einer Einführung fühlen sich Studierende oft verloren – konkrete nächste Schritte geben
und auf die besten freien Quellen verweisen.
:::

---
:::meta
section: Wie es weitergeht
:::
# Was ihr als Nächstes lernen könnt.

- **Pandas** – eine CSV-Datei laden, Zeilen filtern, Gruppenstatistiken berechnen
- **Matplotlib und Seaborn** – Streudiagramme, Heatmaps, Volcano-Plots
- **scikit-learn** – Klassifikation, Clustering, Dimensionsreduktion
- **BioPython** – Sequenzen, BLAST, GenBank- und PDB-Dateien

:::notes
Zum Selbststudium: das offizielle Python-Tutorial für die Syntax, die Pandas-Dokumentation für die Arbeit mit Daten.
Die kostenlosen Python- und Pandas-Kurse von Kaggle sind ausgezeichnet und im eigenen Tempo machbar.
Speziell für die Life Sciences: die BioPython-Dokumentation und das Lehrbuch Python for Bioinformatics (Bassi).
:::

---
:::meta
layout: focus
eyebrow: Merkt euch
:::
# Programmieren lernt man am besten, indem man *Code schreibt*.

:::notes
Damit schliessen. Programmieren ist eine Fertigkeit – sie braucht Übung. Die ersten Wochen fühlen sich langsam an,
dann macht es Klick. Zum täglichen Üben ermutigen, auch mit kleinen Skripten. Auf die Übungen verweisen.
:::

---
:::meta
layout: title
:::
# Fragen?
## Danke – jetzt die Laptops aufklappen.

:::notes
Zeit für Fragen lassen.
Daran erinnern, wo die Kursunterlagen liegen und wie man euch erreicht.
Die nächste Sitzung behandelt Pandas und das Laden echter Datensätze.
:::
