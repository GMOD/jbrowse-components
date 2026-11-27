---
name: chain-mode-sorts-by-the-clicked-base
description: Chain mode refuses every read sort, yet it is the mode that shows two reads at a variant are one fragment's mates, which is when sort-by-base is wanted.
---

# Chain mode sorts by the clicked base

`sortReadsBlockedReason`
(`plugins/alignments/src/LinearAlignmentsDisplay/fitViews.ts`) refuses every
read sort in chain mode, and nothing records a decline. Chain mode shows that
two reads at a variant are one fragment's mates, which is when sort-by-base is
wanted.

- Sorting chains by the member under the clicked base is a
  `computeChainLayout.ts` change; layout is main-thread (ADR-053).
- A tag sort also reopens ADR-188's "chain mode sends no sort tag".

Chain stays an opt-in unit (the declined `auto` unit's reasons sit at
`ALIGNMENTS_UNITS`), so this is not a defaults question.
