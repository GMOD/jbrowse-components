---
name: drawing-the-pggb-75-bp-spur-as-a-linear-glyph
description: Drawing the pggb 75 bp "spur" as a linear glyph
area: figures-that-were-attempted-and-cannot-be-made
---

# Drawing the pggb 75 bp "spur" as a linear glyph

it has no K12
coordinate. `tabix ecoli_pggb.segs.bed.gz 'K12#1#chr:1004500-1004961'` returns
53 records, every one a K12 interval and none of length 75. A glyph draws what
the adapter emits, so this needs a bubbles-style record at the detour's
attachment point, i.e. a build-script change and an upload.
