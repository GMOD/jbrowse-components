---
name: ld-index-and-row-table-follow-ups
description: What two Opus reviews of the 2026-09-26 landings left open after the fixes went in — the Manhattan LD plot as two point marks with the index SNP a pink diamond, and ADR-165 stage 2 on the mark display. Four small items in order, three of them Colin's call, plus the CI snapshot the push will redden. Read before touching the LD toggle, the auto index, or the row table's shader twins.
---

# LD index and row table follow-ups

Landed on 2026-09-26 (`381c6efa78` the two-mark LD plot; `169896b4ca` the
stage-2 landing; `100c313f38` the notices channel from the adapter to the
corner notice). Two Opus reviews ran over the work; everything they confirmed
as a defect is fixed. What follows is what they left, with the reasoning each
needs. **Delete this file once every step under "Next" is done or declined.**

## Next, in order

1. **The LD toggle replaces the plot's marks in both directions.** "Color by
   LD to index SNP" (`setLdColoring` in
   `plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts`) writes
   `LD_MARKS` on and `marks: null` off, so a hand-edited size encoding or a
   text mark is gone after a round trip. A reviewer wanted each point mark
   rewritten in place into its partner/index pair and restored on the way off.
   The counter-argument: the previous per-mark rewrite already replaced the
   shape channel, and an in-place rewrite has to recognise its own marks on
   the way off (by their filter expressions). Colin's call; `ldPlot.test.ts`
   pins today's behaviour.
2. **An LD mark behind `bin` + `aggregate` adopts a bin start as the index.**
   `ldMarkIndexes` admits any visible mark that names an LD field and plots a
   `y`, and an aggregate fills `y`, so `topSnp` names a locus no SNP holds and
   the join finds nothing. Gate the mark out where its steps hold an
   `aggregate`, or say so in the notice. A few lines plus a test beside
   `ldAutoIndex.test.ts`.
3. **No test holds the bar, point and link shaders' `rowTableLookup` to their
   TypeScript twins.** `rowSlot` and `rowColor` (`packages/render-core/src/marks/rowLane.ts`)
   are the JS reading; the shaders read the same `rowTable.slang` module the
   span shape is gated on, so the risk is the placement expression around the
   lookup, not the lookup. The oracle harness (`packages/shader-tools/src/check-oracle.ts`)
   drives scalar functions only and the lookup takes a sampler, so a parity
   test needs either a sampler shim in the C++ probe or a browser test with a
   reorder and a focus on a `rows` mark display (today's `mark display`
   browser suite renders rows in identity order only).
4. **`ConfigSlotDefaults.test.ts` in jbrowse-web goes red on the push.** Its
   snapshot predates the Manhattan and mark-colour slots; CI reports it and it
   is fixed forward, per the root CLAUDE.md.

## Unverified, read not driven, predating the round

- `visibleIndexRange` in `wiggle-core/autoscale.ts` binary-searches starts it
  assumes sorted, and a faceted layer's `x` is in section order.

## Declined during the round, so nobody re-tries it

- Inferring the join from the encodings (`ld_role` shape entries, the colour
  lanes) for the missing-index notice: it held only for plots shaped like
  `LD_MARKS`. The adapter reports through `BaseOptions.notices` instead.
- The auto index following the top *visible* SNP under a row focus: a focus
  would refetch every region, undoing the row table's one-upload promise.
- A conditional colour on the encoding (Vega-Lite's `condition`) for the pink
  index: layering with a `filter` step used pieces the grammar already had.
