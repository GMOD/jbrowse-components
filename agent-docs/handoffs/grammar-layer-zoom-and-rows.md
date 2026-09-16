---
name: grammar-layer-zoom-and-rows
description: The planned next phase of the grammar mark layer after ADR-125, ADR-126 and the mark-vs-wiggle measurement (2026-09-16), in order — the price of encoding a non-drawing layer, and line as the first new shape, with wiggle as its second consumer. Read before adding a mark shape or touching what a layer encodes off-screen.
---

# The grammar layer: the first new shape

Two passes of planning on 2026-09-16 produced this order, and the first pass
was wrong about its first step. Each step names the number that decides it.
**Delete this file when the last step lands or is filed elsewhere.**

What is settled and must not be reopened here: ADR-112's declines of `window`
and `sample`, ADR-113's decline of a ramp on `span` (so density stays
wiggle's), ADR-123's semantics for a summary tier (`score` is the mean,
`minScore` and `maxScore` its extremes, aggregates aggregate tier rows),
ADR-124's retirement of global autoscale, ADR-125's zoom rule (the adapter
declares the bp/px range its answer serves, the payload carries it, and the
displays send the view's `bpPerPx` and key nothing), ADR-126's row lane on
`bar` and `point` (the band is the instance's row, the scale a uniform, and
`facet: 'source'` over `MultiWiggleAdapter` is the multi-row xyplot), and the
measurement under `reference/MARK_ENCODING.md` §"The mark display over a
BigWig, measured": the mark path over a BigWig is between one and four times
the wiggle path's worker work and under a millisecond a screen, a binned
`mean` over a tier sits within a third of a percent of the raw section on
average, and no `validCnt` and no BigWig fast path is worth asking for.

## 1. Price the encode of a layer that does not draw

`layerRequests` sends every mark, and the worker encodes a layer the view's
zoom range excludes. Inside the byte budget that is 74 ns a feature bare and
249 ns with the hover index (`reference/MARK_ENCODING.md`), so 5 to 25 ms a
region against a parse in the hundreds; past the budget the non-density slot
is already `EMPTY` (`densityLayer.ts`). Bench a multiscale pair at in-budget
counts in `packages/core/benches/encodeFeatures.bench.ts` and write the number
in a sentence at `layerRequests`. Build the empty slot only if it beats the
refetch it would cost, since `markView.visible` would become an `rpcProps()`
term. Expected result: decline, ADR-112 holds. 0.5 day, no ADR.

## 2. `line` as a render-core shape, with wiggle as its second consumer

The mark layer has `bar`, `point` and `span`. Wiggle's step line and centre
line, with their bp gap rule, have no shape, and they are the one rendering
wiggle would consume as the second user ADR-040 requires. A render-core
`lineMark` (step and centre variants, gap as a parameter) that wiggle's
`line`/`lineCenter` marks (`plugins/wiggle/src/shared/wiggleMarks.ts`) port
onto, benched against `wiggleLine.slang` and `drawLine` in the manner of
`packages/render-core/benches/placeWalkers.bench.ts` before the mark display
exposes `shape: 'line'`. Whiskers stays wiggle's: its per-side back-to-front
nesting is not a z-order a config can state.

**Kills it.** The port slower than the hand path, or the neighbour lane (the
40-byte stroke record packs prev and next) costing more than the shape saves.
Then line stays wiggle's too.

**Size.** 3 days. **ADR:** yes.

## Tomorrow

Step 1's bench, half a day, then step 2's port: the multi-row xyplot ADR-126
made declarable is the second consumer a render-core `line` would draw for.
