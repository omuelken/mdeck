---
design: fhnw
meta:
  title: "Introduction to Python"
  author: "Tilman Schieber"
  organization: "FHNW"
  date: "2026-05-19"
---

---
layout: title
---
# Python for Life Sciences.
## A step-by-step introduction for Master's students.

:::notes
Welcome to the Python module. This session assumes no prior programming experience.

- We'll move step by step — don't hesitate to interrupt with questions
- All code runs live in the browser — no installation needed today
- Goal: by the end you'll be able to load, inspect, and plot a dataset
:::

---
layout: focus
eyebrow: Why Python?
---
# The tools your field uses are *written in Python*.

:::notes
Python is the dominant language in both academia and industry for data-heavy work.
Life sciences is no exception — bioinformatics, imaging, and clinical data analysis all run on Python.

The ecosystem (NumPy, Pandas, Matplotlib, scikit-learn, BioPython) is unmatched.
Point out that R is still common in statistics, but Python has largely converged as the lingua franca.
:::

---
layout: chapter
number: 1
part: Getting Started
description: Variables, types, and your first lines of code.
---
# Variables and data types.

:::notes
Start here even if students have seen some Python before. We build from the ground up.
Estimated time for this chapter: 20 minutes.
:::

---
layout: split
section: Variables
---

```python live editable copy
# Variables store data
name = "E. coli"
genome_size = 4_641_652   # base pairs
gc_content = 0.506        # 50.6 %

print(f"{name}: {genome_size:,} bp, GC = {gc_content:.1%}")
```

# A variable is a name for a value.
Python works out the type automatically — *no declarations needed.*

:::notes
A variable is just a name attached to a value. Python figures out the type automatically.

Point out: no semicolons, no type declarations, no boilerplate.
Encourage students to change the values and re-run — that's the point of the live block.
:::

---
section: Data Types
---
# Four types cover most biology data.

- **`int`** — whole numbers: counts, positions, indices
- **`float`** — decimals: concentrations, p-values, fold changes
- **`str`** — text: gene names, sequences, sample IDs
- **`bool`** — True / False: significance flags, quality filters

:::notes
Four types students will use constantly. Emphasise that booleans typically come from comparisons,
not literal True/False. Ask: "what type is a p-value? a gene name? a significance flag?"
:::

---
layout: split
section: Strings
---

```python live editable copy
sequence = "ATGCGTAAGCTTGAC"

print("Length:      ", len(sequence))
print("First codon: ", sequence[:3])
print("A count:     ", sequence.count("A"))
print("Reversed:    ", sequence[::-1])
print("Uppercase:   ", sequence.lower().upper())
```

# Strings behave like sequences.
Slicing, counting, and searching work the same on text *and* biological sequences.

:::notes
Strings are sequences — you can slice them just like a nucleotide sequence.
DNA manipulation is a great motivating example: the concepts transfer directly to BioPython later.
:::

---
layout: chapter
number: 2
part: Collections
description: Storing and accessing multiple values at once.
---
# Lists and dictionaries.

:::notes
Most real data is not a single value. Lists and dictionaries are the two workhorse collections.
Estimated time for this chapter: 25 minutes.
:::

---
layout: split
section: Lists
---

```python live editable copy
concentrations = [0.12, 0.45, 0.33, 0.78, 0.21]

print("Samples:", len(concentrations))
print("First:  ", concentrations[0])
print("Last:   ", concentrations[-1])
print("Sorted: ", sorted(concentrations))
print("Mean:   ", sum(concentrations) / len(concentrations))
```

# A list holds an *ordered* sequence of values.
Access items by index — indexing starts at *zero.*

:::notes
Lists maintain order and allow duplicates. Index from 0. Negative indices count from the end.
Great for: time series, replicate measurements, ordered processing steps.

Common mistake: students try index 1 for the first element. Drill 0-indexing early.
:::

---
layout: split
section: Dictionaries
---

```python live editable copy
sample = {
    "id": "S042",
    "organism": "Mus musculus",
    "tissue": "liver",
    "weight_mg": 312,
    "treated": True,
}

print(sample["organism"])
print("Treated:", sample["treated"])

sample["weight_mg"] = 318   # update a field
print("Updated weight:", sample["weight_mg"])
```

# A dictionary maps *keys* to values.
Look up any field instantly by name — no loops, no column indices.

:::notes
Dictionaries map keys to values. Perfect for structured records — one dictionary = one sample.
Later, a list of dictionaries becomes a Pandas DataFrame. Plant that seed now.
:::

---
layout: chapter
number: 3
part: Control Flow
description: Making decisions and repeating operations across your data.
---
# Decisions and loops.

:::notes
These two constructs — if and for — cover the vast majority of logic in data processing scripts.
Estimated time for this chapter: 25 minutes.
:::

---
layout: split
section: Conditions
---

```python live editable copy
p_value = 0.023
fold_change = 2.4

if p_value < 0.05 and fold_change > 2:
    print("Significant upregulation")
elif p_value < 0.05:
    print("Significant — but modest effect")
else:
    print("Not significant")
```

# `if` chooses a path based on a condition.
Indentation defines the block — *Python uses whitespace, not braces.*

:::notes
if / elif / else covers all branching. Indentation is not stylistic in Python — it is syntax.
This trips up students from other languages or R. The colon and the indent are mandatory.
Show what happens if you forget the colon: Python gives a SyntaxError.
:::

---
layout: split
section: Loops
---

```python live editable copy
measurements = [1.2, 0.8, 2.1, 1.5, 0.9, 2.8, 1.1, 1.7]

above_threshold = []
for value in measurements:
    if value > 1.0:
        above_threshold.append(value)

print(f"{len(above_threshold)} of {len(measurements)} above threshold")
print("Values:", above_threshold)
```

# `for` repeats an action for every item.
Loop → test → collect is the core pattern of *data filtering.*

:::notes
for loops iterate over any collection. This pattern — loop, test, collect — is at the heart of
almost every data processing script students will write.

After showing this, ask: "how would you count how many are below threshold instead?"
:::

---
layout: chapter
number: 4
part: Functions
description: Packaging logic so you can reuse and test it.
---
# Functions package logic for reuse.

:::notes
Functions are the first step toward reusable, testable code.
Motivate with: "you'll run this same calculation on 200 samples — write it once, call it 200 times."
Estimated time for this chapter: 20 minutes.
:::

---
layout: split
---

```python live editable copy
def gc_content(sequence):
    """Return the GC fraction of a DNA sequence."""
    g = sequence.count("G")
    c = sequence.count("C")
    return (g + c) / len(sequence)

sequences = ["ATGCGC", "AATTAA", "GCGCGC", "ATATATAT"]
for seq in sequences:
    print(f"{seq}:  GC = {gc_content(seq):.1%}")
```

# A function takes *inputs* and returns an *output.*
Write it once — call it on every sample.

:::notes
def, parameters, return — that's the whole syntax.
Walk through: define once, call many times with different inputs.
The docstring (triple-quoted string after def) is best practice — introduce it early.
:::

---
layout: chapter
number: 5
part: Scientific Python
description: NumPy, Pandas, and Matplotlib — the three pillars.
---
# The scientific stack.

:::notes
These three libraries are what make Python the dominant language in data science.
Students won't write much pure Python in practice — they'll use these.
Estimated time for this chapter: 30 minutes.
:::

---
# Three libraries cover most life sciences workflows.

- **NumPy** — fast arrays: mathematical operations on entire datasets at once
- **Pandas** — tabular data: load, filter, group, and summarise spreadsheet-style data
- **Matplotlib** — publication-quality plots with full control over every element

:::notes
Brief overview before diving in. The key message: these libraries handle the heavy lifting
so students write less code and get faster, more reliable results than with pure Python loops.
:::

---
layout: split
section: NumPy
---

```python live copy
import numpy as np

measurements = np.array([1.2, 0.8, 2.1, 1.5, 0.9, 2.8, 1.1, 1.7])

print("Mean:  ", measurements.mean().round(3))
print("Std:   ", measurements.std().round(3))
print("Median:", np.median(measurements))

# Vectorised filter — no loop needed
print("Above 1.5:", measurements[measurements > 1.5])
```

# NumPy operates on *entire arrays* at once.
No loops, no manual indexing — fast and readable.

:::notes
NumPy operations apply to the whole array at once — no loops. This is both faster and more readable.
The vectorised style ("broadcast operations") takes getting used to but is worth learning early.
Demo: ask students to predict what measurements > 1.5 returns before running it.
:::

---
layout: focus
eyebrow: Key insight
---
# Write operations on *arrays*, not on *individual values*.

:::notes
This is the most important mental model shift from pure Python to scientific Python.
Repeat it, let it sink in. Students who internalise this early write much cleaner code later.
:::

---
layout: chapter
number: 6
part: Next Steps
description: Where to go from here.
---
# Keep going.

:::notes
Close with a roadmap. Students often feel lost after an intro — give them concrete next steps
and point them to the best free resources.
:::

---
# What to learn next.

- **Pandas** — load a CSV, filter rows, compute group statistics, export results
- **Matplotlib / Seaborn** — scatter plots, heatmaps, survival curves, volcano plots
- **scikit-learn** — classification, clustering, dimensionality reduction
- **BioPython** — sequence analysis, BLAST, GenBank, PDB structure files

:::notes
For self-study: the official Python tutorial for syntax, Pandas documentation for data work.
Kaggle's free Python and Pandas courses are excellent and self-paced.
For life sciences specifically: BioPython docs, and the Python for Bioinformatics textbook (Bassi).
:::

---
layout: focus
eyebrow: Remember
---
# The best way to learn to code is to *write code.*

:::notes
Close on this. Programming is a skill — it takes practice. The first few weeks feel slow,
then things click. Encourage daily practice, even small scripts. Point to the exercises.
:::

---
layout: title
---
# Questions?
## Thank you — now open your laptops.

:::notes
Leave time for questions.
Remind students where to find the course materials and how to reach you.
The next session will cover Pandas and loading real datasets.
:::
