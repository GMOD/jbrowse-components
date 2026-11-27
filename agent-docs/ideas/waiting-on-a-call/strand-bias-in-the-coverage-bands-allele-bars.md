---
name: strand-bias-in-the-coverage-bands-allele-bars
description: The coverage band already holds per-allele strand counts, so it could show strand bias where a reviewer checks a candidate SNV; the open choice is split fwd/rev segments or a one-bit bias flag.
---

# Strand bias in the coverage band's allele bars

`mismatchStrands` already ships and `countSnpsAtPosition` reads it (the
tooltip's Strands column is built from it), so showing strand per allele is a
compute-side change with no new payload. Strand bias is one of the two things a
reviewer checks a candidate SNV for, and the band is where they are looking.

- **Split segments**: two half-width segments per allele double the instance
  count and go sub-pixel fast. The segments are already stacked bottom-to-top
  by lane, so a split has to pick a second axis.
- **A bias flag**: a mark on the position, the allele still drawn whole, costs
  one bit and says the same thing at every zoom.

Decide the encoding before writing either.
