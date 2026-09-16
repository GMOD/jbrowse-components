---
name: grammar-layer-zoom-and-rows
description: The planned next phase of the grammar mark layer after ADR-123 and ADR-124 (2026-09-16), in order — the adapter declares the zoom range its answer serves so the wiggle displays and the mark display stop refetching per zoom step and read one tier; a measured comparison of the two displays over one BigWig; a row lane on bar and point so MultiQuantitativeTrack is a marks config with no new shape; the price of encoding a non-drawing layer; and line as the first new shape, with wiggle as its second consumer. Read before touching a wiggle or mark fetch key, adding a mark shape, or attaching the mark display to another track type.
---

# The grammar layer: zoom, rows and the first new shape

Two passes of planning on 2026-09-16 produced this order, and the first pass
was wrong about step 1. Each step names the number that decides it. **Delete
this file when the last step lands or is filed elsewhere.**

What is settled and must not be reopened here: ADR-112's declines of `window`
and `sample`, ADR-113's decline of a ramp on `span` (so density stays
wiggle's), ADR-123's semantics for a summary tier (`score` is the mean,
`minScore` and `maxScore` its extremes, aggregates aggregate tier rows), and
ADR-124's retirement of global autoscale.

## 1. The adapter declares the bp/px range its answer serves

**Goal.** One zoom rule for the wiggle displays and the mark display, so a
zoom inside a tier refetches nothing and no rule ever picks a finer tier than
the view would.

**Why the obvious rules fail, with the numbers.** bbi picks the finest tier
whose `reductionLevel <= 2 * bpPerPx` (`node_modules/@gmod/bbi/esm/bigwig.js`,
`getView`) and the raw section below the first. A BigWig's tiers sit 4x apart
and a display cannot see them, so any display-side value under the view's
`bpPerPx` over-reads somewhere. `volvox_microarray.bw` has tiers at 3,478,
13,912 and 55,648 bp:

```
node --input-type=module -e "import {BigWig} from '@gmod/bbi'; import {LocalFile} from 'generic-filehandle2'; const h=await new BigWig({filehandle:new LocalFile('test_data/volvox/volvox_microarray.bw')}).getHeader(); console.log(h.zoomLevels.map(z=>z.reductionLevel))"
```

Over a 140-step sweep of that ladder, the auto-bin rung's floor (what ADR-123
first shipped) picks a finer tier than the raw value on 27 steps, 1.44x the
instances overall, 348x on the worst, and reads the raw section from 1,739 to
2,500 bp/px. A snap-down to doublings does the same on 13 steps. The raw value
(what wiggle sends and ADR-123 now sends) never over-reads and refetches on
all 140. The adapter's own range refetches on 11 and over-reads on none.

**The mechanism.** `BigWigAdapter` computes the bp/px interval its picked
tier serves, `[t_i / 2, t_{i+1} / 2)` scaled by `resolution` and
`resolutionMultiplier` (raw section `[0, t_0 / 2)`), from
`header.zoomLevels`, and returns it beside the arrays. `MultiWiggleAdapter`
intersects its sources'. `WiggleDataResult`
(`packages/wiggle-core/src/dataTypes.ts`) and `EncodedFeaturesResult`
(`packages/core/src/util/markEncodingTypes.ts`) carry `zoomRange`.
`MultiRegionDisplayMixin.regionHasData`
(`packages/display-kit/src/MultiRegionDisplayMixin.ts`) answers whether
`host.bpPerPx` is inside a payload's range when one is present, the hook the
multi-row and variants displays already fill for "does the held answer
serve". `zoomFetchArgs()` goes empty on all three displays and each sends the
raw `host.bpPerPx` at its call site, which is the alignments precedent
(`plugins/alignments/src/LinearAlignmentsDisplay/model.ts`, its RPC call).
`WiggleCommonMixin.zoomFetchKey` and MultiWiggle's call-site `bpPerPx` go with
it: one fact, one spelling.

ADR-008's drift case cannot recur: `fetchRegions` stamps `fetchInputs` per
region and `isCacheValid` compares the whole set structurally, which is the
per-region form ADR-008 rejected and the tree has had since.

**Anchors.** `plugins/marks/src/LinearMarkDisplay/model.ts` `zoomFetchArgs`;
`plugins/wiggle/src/LinearWiggleDisplay/model.ts` `zoomFetchArgs`;
`plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts` `fetchNeeded`;
`plugins/wiggle/src/BigWigAdapter/BigWigAdapter.ts` `getArrayFeatureView`.

**Proof.** The mark display's 64-step sweep test
(`plugins/marks/src/LinearMarkDisplay/model.test.ts`, "a zoom sweep refetches
once per rung") rewritten to count `regionHasData` flips over a 4x ladder, 11
per sweep; the wiggle fetch autorun test
(`plugins/wiggle/src/LinearWiggleDisplay/fetchAutorun.test.ts`) inverted so a
zoom inside the tier's range refetches nothing;
`products/jbrowse-web/browser-tests/suites/bigwig.ts` goldens unchanged, since
the tier is unchanged. The `mark-display.ts` suite beside it is where steps 2
and 3 add their scenes.

**Kills it.** bbi's selection rule duplicated in the adapter drifting from
`getView`. Mitigate with a one-field upstream export of the picked level.

**Size.** 2 days. **ADR:** yes, superseding ADR-008's mechanism and closing
ADR-123's per-step refetch.

## 2. Measure the mark display beside the wiggle display over one BigWig

**Goal.** A number for whether the mark path over a BigWig is within reach of
the hand path, before any shape is added for it. Same file, same locus, same
tier, which is why this follows step 1.

**Measure.** Rows returned; worker wall time, `RenderWiggleData` against
`CoreEncodeFeatures`; frame cost through the `mark-display.ts` and `bigwig.ts`
browser suites; and the mean-of-means error of a binned `mean` over a tier
against the raw section, which is the number that says whether exposing
`validCnt` from `@gmod/bbi` (it parses it and exports no count) is ever worth
asking for.

**Files.** A test beside `products/jbrowse-web/src/tests/MarkDisplay.test.tsx`,
`agent-docs/measurements/<id>.json`, a row in `reference/MARK_ENCODING.md`.

**Size.** 1 day. **ADR:** no. It decides steps 3 and 5.

Not a step: a `getFeaturesArray` override on `BigWigAdapter`. `BigWigFeature`
already reads typed arrays lazily, and the rxjs collect it would save runs
over at most a couple of thousand tier rows per screen once step 1 holds.

## 3. A `row` lane on `bar` and `point`, and MultiQuantitativeTrack joins

**Goal.** A multi-row xyplot as a marks config with no new shape: `facet:
'source'` over `MultiWiggleAdapter`, whose features carry `source`.

**Mechanism.** `SHAPE_LANES` (`plugins/marks/src/LinearMarkDisplay/markList.ts`)
gains `row` for both shapes; `barMark` and `pointMark` take `rowHeight` the way
`spanMark` does; `facetRows` (`packages/core/src/util/featureTransforms.ts`)
already gives a feature with no row its group's row. `index.ts` adds the track
type. Nothing is extracted, so ADR-040's two-consumer bar is not in play.

**Proof.** A `mark-display.ts` scene over `volvox_microarray_multi` beside the
`bigwig-multibigwig-multirowxy` golden; `sweepMarkAgainstHit` for both shapes.

**Kills it.** The per-row y transform costing the bar shader its shared-scale
uniform path, or the facet chip row needing a per-section axis the chrome
cannot place.

**Size.** 1.5 days. **ADR:** yes, short.

## 4. Price the encode of a layer that does not draw

`layerRequests` sends every mark, and the worker encodes a layer the view's
zoom range excludes. Inside the byte budget that is 74 ns a feature bare and
249 ns with the hover index (`reference/MARK_ENCODING.md`), so 5 to 25 ms a
region against a parse in the hundreds; past the budget the non-density slot
is already `EMPTY` (`densityLayer.ts`). Bench a multiscale pair at in-budget
counts in `packages/core/benches/encodeFeatures.bench.ts` and write the number
in a sentence at `layerRequests`. Build the empty slot only if it beats the
refetch it would cost, since `markView.visible` would become an `rpcProps()`
term. Expected result: decline, ADR-112 holds. 0.5 day, no ADR.

## 5. `line` as a render-core shape, with wiggle as its second consumer

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

Step 1's oracle, then the adapter range. It removes the per-step refetch that
ADR-123 accepted as interim, retires one zoom fact spelled three ways across
three displays, and step 2's comparison is meaningless until both displays
read the same tier.
