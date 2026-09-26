---
name: multiway-lanes-draw-no-gene-names
description: MultiWaySyntenyDisplay's lanes draw gene glyphs and no gene names, so across a 40-lane star the only way to read a gene is hover. Placing names in a stack of one-row bands without clutter is the design call — which lanes label (anchor only, all, the hovered group), where the text goes, and whether it costs lane height. The one-row-with-names half is the same problem as collapsed-mode-labels. Read before adding text to the lane stack.
---

# Multi-way lanes draw no gene names

`MultiWaySyntenyDisplay` reuses the canvas plugin's `featureGlyphMarks` for each
lane (`multiwayMarks.ts`), but none of the label machinery that goes with them:
`LinearBasicDisplay` gets its names from worker-emitted `FeatureLabelData` and
reserves label rows in its layout (`applyLayout.ts`), while a lane is a
fixed-height band positioned in px. So a reader of the E. coli or primate star
names a gene only by hovering it, one lane at a time.

This is a product change, not a cleanup, and it waits on a call about what to
label:

- **Anchor lane only.** Cheapest and uncluttered; the ribbons already carry the
  eye to the other lanes. Leaves the question "what is this gene called in
  lane 23" to hover.
- **Every lane, fit-or-drop.** Names where there is room, dropped where there is
  not. Densest reading; at 40 lanes the stack becomes mostly text, and a lane
  with names needs height a bare band does not.
- **The hovered or clicked group.** The display already groups genes across
  lanes by `groupKeyOf` (name, else `syntenyId`); naming only that group's
  members down the stack answers "where did this gene go" without labelling the
  rest.

Whichever lane labels, it labels a one-row band, which is the constraint
[collapsed-mode-labels](collapsed-mode-labels.md) already works through for the
linear display (a solver rather than a row, stable under pan). An answer there
is a candidate answer here, so the two want deciding together rather than
twice.
