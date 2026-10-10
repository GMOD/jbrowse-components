---
name: translate-in-the-get-sequence-dialog
description: GetSequenceDialog reverses and complements but cannot translate, so a protein from the visible region means a trip to another tool. A frame choice over getGeneticCode's table would close it.
---

# Translate in the Get sequence dialog

`GetSequenceDialog` (opened from the reference sequence track's "Get sequence
(visible region)" and from the rubberband menu) offers reverse and complement
checkboxes. It has no translation, though the display it is launched from draws
all six frames. A frame selector (+1..+3, -1..-3) translating through the
region's own genetic code (`assembly.getGeneticCodeId`, then
`getGeneticCode().codonTable`) would emit the protein as FASTA beside the
nucleotide copy buttons.
