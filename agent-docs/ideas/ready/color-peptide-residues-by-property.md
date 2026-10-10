---
name: color-peptide-residues-by-property
description: A protein reference track draws every residue in the one fallback grey. Coloring by a residue property (hydrophobicity, charge) and naming it in the hover would make the track read as more than letters.
---

# Color peptide residues by property

A `ReferenceSequenceTrack` with `sequenceType: 'pep'` draws one row of residues,
all in `ColorPalette.fallback`, since only DNA consults the base palette
(`baseCell` in `sequenceCells.ts`). A residue palette keyed by a property such
as hydrophobicity or charge, built in `buildColorPalette` beside the base one,
would give the row structure at a glance. The hover would name the residue and
its class rather than repeating the letter.
