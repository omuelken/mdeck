---
theme: fhnw
meta:
  title: "Introduction to Python"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-05-19"
---

---
:::meta
layout: title
id: python-for-life-sciences
:::
# Python for Life Sciences.
## A step-by-step introduction for Master's students.

:::notes
Welcome to the Python module. This session assumes no prior programming experience.

- We'll move step by step — don't hesitate to interrupt with questions
- All code runs live in the browser — no installation needed today
- Goal: by the end you'll be able to load, inspect, and plot a dataset
:::

---
:::meta
layout: focus
eyebrow: Why Python?
id: the-tools-your-field-uses-are-written-in
:::
# The tools your field uses are *written in Python*.

:::notes
Python is the dominant language in both academia and industry for data-heavy work.
Life sciences is no exception — bioinformatics, imaging, and clinical data analysis all run on Python.

The ecosystem (NumPy, Pandas, Matplotlib, scikit-learn, BioPython) is unmatched.
Point out that R is still common in statistics, but Python has largely converged as the lingua franca.
:::

---
:::meta
layout: chapter
number: 1
part: Getting Started
description: Variables, types, and your first lines of code.
id: variables-and-data-types
:::
# Variables and data types.

:::notes
Start here even if students have seen some Python before. We build from the ground up.
Estimated time for this chapter: 20 minutes.
:::

---
:::meta
layout: split
section: Variables
id: variables-store-data
props:
  ratio: [3, 2]
:::
# A variable is a name for a value.
:::slot left
```python live editable copy
name = "E. coli"
genome_size = 4_641_652   # base pairs
gc_content = 0.506        # fraction

print(name, genome_size, gc_content)
print(f"GC content: {gc_content:.1%}")
```
:::
:::slot right
No declarations: Python sees the type from the value.

**Try it:** change `gc_content` to `0.65` and run again.
:::

:::notes
A variable is just a name attached to a value. Python figures out the type automatically.

Point out: no semicolons, no type declarations, no boilerplate. The `f"…"` string formats a value inside text; `:.1%` shows a fraction as a percentage.
Encourage students to change the values and re-run — that's the point of the live block.
:::

---
:::meta
section: Data Types
id: four-types-cover-most-biology-data
:::
# Four types cover most biology data.

:::steps
- **`int`** — whole numbers: counts, positions, indices
- **`float`** — decimals: concentrations, p-values, fold changes
- **`str`** — text: gene names, sequences, sample IDs
- **`bool`** — True or False: significance flags, quality filters
:::

:::notes
Reveal one type at a time and ask for an example from the lab before showing the next.

Emphasise that booleans typically come from comparisons, not literal True/False. The next slide asks the room.
:::

---
:::meta
section: Data Types
title: "Poll: the type of a p-value"
id: poll-the-type-of-a-p-value
:::
# What type is a p-value?

<poll room="p-value" options="int|float|str|bool" answer="float" />

:::notes
A quick check before moving on. Phones join with the QR code; start the deck with `mdeck run slides.md --network` so they can reach this computer.

Answer: `float`; the tick button under the bars marks it. If many chose `bool`, they are thinking of the *significance flag* computed from it (`p < 0.05`): a good moment to show that comparisons produce booleans.
:::

---
:::meta
layout: split
section: Strings
props:
  ratio: [3, 2]
:::
# Strings behave like sequences.
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
Slicing, counting and replacing work the same on any text.

**Try it:** print the last codon with `dna[-3:]`.
:::

:::notes
Strings are sequences — you can slice them just like a nucleotide sequence.
`replace("T", "U")` is transcription in one line. The concepts transfer directly to BioPython later.
:::

---
:::meta
layout: chapter
number: 2
part: Collections
description: Storing and accessing multiple values at once.
:::
# Lists and dictionaries.

:::notes
Most real data is not a single value. Lists and dictionaries are the two workhorse collections.
Estimated time for this chapter: 25 minutes.
:::

---
:::meta
layout: split
section: Lists
props:
  ratio: [3, 2]
:::
# A list holds values in order.
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
Counting starts at zero: `conc[0]` is the first item, `conc[-1]` the last.

**Try it:** add a sixth value and watch the mean change.
:::

:::notes
Lists maintain order and allow duplicates. Index from 0. Negative indices count from the end.
Great for: time series, replicate measurements, ordered processing steps.

Common mistake: students try index 1 for the first element. Drill 0-indexing early.
:::

---
:::meta
layout: split
section: Dictionaries
props:
  ratio: [3, 2]
:::
# A dictionary looks values up by name.
:::slot left
```python live editable copy
sample = {
    "id": "S042",
    "organism": "Mus musculus",
    "tissue": "liver",
    "weight_mg": 312,
}

print(sample["organism"])
sample["weight_mg"] = 318   # update a field
print(sample)
```
:::
:::slot right
One dictionary describes one sample: no column numbers to remember.

**Try it:** add `"treated": True`.
:::

:::notes
Dictionaries map keys to values. Perfect for structured records — one dictionary = one sample.
Later, a list of dictionaries becomes a Pandas DataFrame. Plant that seed now.
:::

---
:::meta
layout: chapter
number: 3
part: Control Flow
description: Making decisions and repeating operations across your data.
:::
# Decisions and loops.

:::notes
These two constructs — if and for — cover the vast majority of logic in data processing scripts.
Estimated time for this chapter: 25 minutes.
:::

---
:::meta
layout: split
section: Conditions
props:
  ratio: [3, 2]
:::
# `if` chooses a path.
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
The indentation is the block: Python uses whitespace, not braces.

**Try it:** set `fold_change = 1.5`.
:::

:::notes
if / elif / else covers all branching. Indentation is not stylistic in Python — it is syntax.
This trips up students from other languages or R. The colon and the indent are mandatory.
Show what happens if you forget the colon: Python gives a SyntaxError.
:::

---
:::meta
layout: split
section: Loops
props:
  ratio: [3, 2]
:::
# `for` repeats an action for every item.
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
Loop, test, collect: the core pattern of filtering data.

**Try it:** count the values below 1.0 instead.
:::

:::notes
for loops iterate over any collection. This pattern — loop, test, collect — is at the heart of
almost every data processing script students will write.

Press **D** and trace one value through the loop on the slide: into `value`, through the `if`, into `above`. Escape stops drawing; the drawing stays with the slide.
:::

---
:::meta
layout: chapter
number: 4
part: Functions
description: Packaging logic so you can reuse and test it.
:::
# Functions package logic for reuse.

:::notes
Functions are the first step toward reusable, testable code.
Motivate with: "you'll run this same calculation on 200 samples — write it once, call it 200 times."
Estimated time for this chapter: 20 minutes.
:::

---
:::meta
layout: split
section: Functions
props:
  ratio: [3, 2]
:::
# A function turns inputs into an output.
:::slot left
```python live editable copy
def gc_content(seq):
    """Return the GC fraction of a sequence."""
    gc = seq.count("G") + seq.count("C")
    return gc / len(seq)

for seq in ["ATGCGC", "AATTAA", "GCGCGC"]:
    print(seq, f"{gc_content(seq):.0%}")
```
:::
:::slot right
Write it once, then call it on every sample.

**Try it:** add your own sequence to the list.
:::

:::notes
def, parameters, return — that's the whole syntax.
Walk through: define once, call many times with different inputs.
The docstring (triple-quoted string after def) is best practice — introduce it early.
:::

---
:::meta
layout: chapter
number: 5
part: Scientific Python
description: NumPy, Pandas, and Matplotlib — the three pillars.
:::
# The scientific stack.

:::notes
These three libraries are what make Python the dominant language in data science.
Students won't write much pure Python in practice — they'll use these.
Estimated time for this chapter: 30 minutes.
:::

---
:::meta
section: Scientific Python
:::
# Three libraries cover most life sciences workflows.

:::steps
- **NumPy** — fast arrays: calculate on a whole dataset at once
- **Pandas** — tables: load, filter, group and summarise spreadsheet data
- **Matplotlib** — plots, with control over every element
:::

:::notes
Brief overview before diving in. The key message: these libraries handle the heavy lifting
so students write less code and get faster, more reliable results than with pure Python loops.
:::

---
:::meta
layout: split
section: NumPy
props:
  ratio: [3, 2]
:::
# NumPy calculates on whole arrays.
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
`m[m > 1.5]` filters without a loop.

Compare it with the `for` loop two chapters ago.
:::

:::notes
NumPy operations apply to the whole array at once — no loops. This is both faster and more readable.
The vectorised style takes getting used to but is worth learning early.
Demo: ask students to predict what `m > 1.5` returns before running it.
:::

---
:::meta
layout: focus
eyebrow: Key insight
:::
# Write operations on *arrays*, not on single values.

:::notes
This is the most important mental model shift from pure Python to scientific Python.
Repeat it, let it sink in. Students who internalise this early write much cleaner code later.
:::

---
:::meta
layout: chapter
number: 6
part: Next Steps
description: Where to go from here.
id: keep-going
:::
# Keep going.

:::notes
Close with a roadmap. Students often feel lost after an intro — give them concrete next steps
and point them to the best free resources.
:::

---
:::meta
section: Next Steps
:::
# What to learn next.

- **Pandas** — load a CSV, filter rows, compute group statistics
- **Matplotlib and Seaborn** — scatter plots, heatmaps, volcano plots
- **scikit-learn** — classification, clustering, dimensionality reduction
- **BioPython** — sequences, BLAST, GenBank and PDB files

:::notes
For self-study: the official Python tutorial for syntax, Pandas documentation for data work.
Kaggle's free Python and Pandas courses are excellent and self-paced.
For life sciences specifically: BioPython docs, and the Python for Bioinformatics textbook (Bassi).
:::

---
:::meta
layout: focus
eyebrow: Remember
:::
# The best way to learn to code is to *write code*.

:::notes
Close on this. Programming is a skill — it takes practice. The first few weeks feel slow,
then things click. Encourage daily practice, even small scripts. Point to the exercises.
:::

---
:::meta
layout: title
:::
# Questions?
## Thank you — now open your laptops.

:::notes
Leave time for questions.
Remind students where to find the course materials and how to reach you.
The next session will cover Pandas and loading real datasets.
:::
