---
name: synteny-ribbons-default-to-four-colors
description: An uncolored synteny alignment paints red, grey, steel blue or black depending on the view, so the same PIF changes color when moved between linear synteny, multi-way, chord and dotplot.
---

# Synteny ribbons default to four colors

The same alignment, with no color set, paints:

| View | Default | Where |
| --- | --- | --- |
| Linear synteny | red, the CIGAR `M` color | `DEFAULT_RIBBON_CSS`, `packages/synteny-core/src/colorFunctions.ts` |
| Multi-way synteny | `rgb(130,130,130)` | `RIBBON_GREY`, `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/ribbonColorConfigSchema.ts` |
| Chord synteny | `rgb(70,130,180)` | `DEFAULT_ABGR`, `plugins/circular-view/src/ChordSyntenyDisplay/models/stateModelFactory.ts` |
| Dotplot | `#000` | `colorSchemes.default.pointColor`, `packages/synteny-core/src/colorUtils.ts` |

So switching a track between views changes its color for no reason in the data.

## Proposal

One default ribbon color exported from `synteny-core`, read by all four. The
dotplot keeps black only if a capture shows a colored line reads worse on its
grid, since black there is a dot-plot convention rather than a ribbon choice.

## What deciding it involves

- the color: red ties the default to the CIGAR legend's match color, grey
  reads as "uncolored" and keeps the categorical colors loud when a field is
  set;
- captures of one PIF in each view, light theme (the band ground stays light,
  `packages/synteny-core/src/bandGround.ts`);
- the figures that show an uncolored ribbon reshoot.
