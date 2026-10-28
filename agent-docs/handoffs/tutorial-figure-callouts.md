---
name: tutorial-figure-callouts
description: "Tutorial figures that leave a first-time reader guessing. The callout sweep is on main. Open: hprc_amylase_stack's yellow and blue ribbons have no key, because the app hides the strand legend on ribbons and drops the indel chips with it."
---

# Tutorial figure callouts: what is left

- **In:** a tutorial figure and the question "what would a reader new to JBrowse not know?"
- **Out:** a highlight, pill, leader label or menu box that answers it, in the figure's spec.

Rules: callouts and captions in `website/CLAUDE.md`, anchors and `highlights` in
`website/scripts/CLAUDE.md`, capture in
[FIGURE_CAPTURE.md](../reference/FIGURE_CAPTURE.md).

## Next

`multiway_synteny/hprc_amylase_stack` paints `encoding.color: 'strand'`: blue is
a reverse-strand alignment, yellow the CIGAR insertion wedge and purple the
deletion wedge (`strandCigarColors` in `packages/synteny-core/src/colorUtils.ts`).
The app's strand key lists those chips, but `hasLegendKey` in
`packages/synteny-core/src/TrackColorsMixin.ts` hides the strand key whenever
`shapeShowsStrand()`, which is always on ribbons, and so drops the indel chips
too.

- Keep the key on ribbons while `presentCigarKinds` is nonzero, then reshoot
  the figure. A hand-drawn `legend` annotation would copy the app's rules.

## Colin's constraints

- Few callouts, each a few words in plain language; delete one before shortening it.
- No counts and no step numbers on a figure.
- The app chrome stays in the frame, and capture width stays at the realistic ~1500 px.
- A stacked figure stops at two panels (2026-10-24).
- Prefer a pill on the app's own label to a highlight chip when the name is what
  the reader needs: a highlight's label is app-sized text, ~7px at figure scale.

## Seen in passing

- The all-vs-all lanes now draw a "Show 1 hidden" chip on CFT073
  (`multiway_synteny/ecoli_launch_selection`), from a display change on main.
- `pangenome/bovine_polled`'s variant track no longer draws its feature row
  (">282>284 GGTATTC -> 209bp") above the matrix, as of the 2026-10-28 reshoot.
