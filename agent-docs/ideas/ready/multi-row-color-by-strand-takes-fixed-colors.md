---
name: multi-row-color-by-strand-takes-fixed-colors
description: The multi-row display's Color by → Strand paints through an ordinal scale, so plus and minus take whichever palette colors the scale assigns
---

# Multi-row Color by → Strand takes fixed colors

Left from ADR-249's multi-row swap.

- `plugins/marks/src/LinearMultiRowFeatureDisplay/multiRowMenus.ts` lists a
  Strand row that sets `encoding.color.field` to the strand, and the ordinal
  scale picks the colors.
- The swap plan wanted a preset: a `scale.domain` and `range` pinning plus and
  minus to two fixed colors, so a strand reads the same on every multi-row
  track.
