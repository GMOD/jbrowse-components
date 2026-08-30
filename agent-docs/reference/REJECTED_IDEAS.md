---
name: rejected-ideas
description: Ideas that were investigated, costed or measured and then declined — one entry each, grouped by subsystem. Read before proposing a refactor, a perf fix, or a demo dataset that looks obviously worth doing; a fair number of these look obviously worth doing.
---

# Rejected ideas

Tried, measured or costed, then declined. Most entries exist because the idea
was proposed more than once.

Load-bearing decisions get an [ADR](../architecture-decision-records/README.md)
and a link from here. Deferred-but-alive proposals go in
[ideas/](../ideas/README.md).

New entry: one bullet, idea first, then the verdict. Keep the measurement.

## Rendering and displays

- **Compose a second consumer onto the shared y scale, the way density composed
  the colour ramp** — censused and declined 2026-08-29. The census is
  [ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md);
  the scale half of the y channel already factored under
  [ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md)
  and every remaining candidate trips a kill condition. Four were measured.
  *Manhattan onto `scoreScale`*: `scoreToYPx(0.5, 0, 0, 100)` is 0 and
  `normalizeScore`'s answer places the same score at 100, so a score above a
  pinned degenerate domain moves by the full canvas height — a value
  `scoreToYParity.test.ts` pins as a deliberate Canvas2D fix — and Manhattan's
  `scaleType: 'linear'` is fixed in three places, so the composed uniforms would
  have exactly one caller (ADR-040). *The coverage tick anchor onto wiggle's
  `scoreToAxisY`*: identical above `covHeight = 10` and divergent below, where at
  `covHeight = 8` the coverage anchor answers 3 for every normalized value and
  the wiggle anchor answers 5 — the short-band case `covEffectiveHeightPx`'s
  floor exists for. *The arc band's `arcYFraction` with hic's `mapHicCount`*:
  the log branches are the same expression, the linear branches and the clamp
  placement are not, and factoring the shared line leaves both wrappers, both
  `//! js-export`s and both parity suites — one line deleted, no twin.
  *Deleting `coverageBand.slang`'s `normalizeDepthScalar`*: its shader body is
  already a one-line delegation, and its only non-generated caller is the
  alignments coverage parity sweep it exists to be the oracle for. Reopen if a
  new display arrives whose y anchor is genuinely one of the existing ones — a
  second display banding a scalar against a baseline with reserved insets at both
  ends is the shape to watch for, since that would give the coverage anchor its
  second consumer.

- **Mirror the RNA-seq coverage band about zero, plus strand up and minus down**
  — declined by the splice thread (`c39ae756e7`..`bc04116182`), which recorded
  the verdict and not the reasoning, so treat this as a decision made rather than
  a cost established. What a re-proposal has to beat: the band is the part of a
  spliced pileup that reads at a glance, mirroring halves the height each strand
  gets, and strand is already legible per read through
  `First-of-pair`/`Second-of-pair` colouring — where the same row also shows
  which junctions it crosses. Bring a case where the reader needs strand at the
  column rather than at the row. The rest of what the thread parked is in
  [ideas/rnaseq-splice-followups.md](../ideas/rnaseq-splice-followups.md).

- **Put `LinearManhattanDisplay` on the wiggle family's `plotGeometry` and
  shared views** — proposed as backlog work, checked 2026-08-25 and declined:
  the duplication it names is either deliberate or not duplication. Of the four
  members `wiggleDisplayViews` states, `ticks` is the only candidate, and
  Manhattan pins `scaleType: 'linear'` and ignores `symlogConstant` by design
  (its scores are pre-transformed -log10 p values) where the shared getter
  passes both through, so sharing it means a scaleType override existing for one
  caller. `renderState` is a different type — `ManhattanRenderState` is
  `{domainY, canvasWidth, canvasHeight, pointDiameterPx}` against
  `WiggleGPURenderState`'s scaleType, symlogConstant, renderingType, numRows,
  lineWidth and origin. `scoreRamp` needs a density mode Manhattan has not, and
  `sharedRpcProps`/`sharedGpuProps` name fetch keys it does not fetch on. The
  duplicated `minimalTicks` slot is deliberate and says so at
  `WiggleCommonMixin.ts`'s `wiggleCommonExtraSlots`: "declared per display
  because the shared field table is spread by `LinearManhattanDisplay` too,
  which owns its own axis." And `plotGeometry` collapses for Manhattan to
  `axisPlotBox(height)` with `numRows: 1`, which it already calls directly on
  both sides — its ticks and its render canvas agree, so there is no drift to
  close.

- **Bound a track's drag height at `maxCanvasCssPx()`** — declined 2026-08-25.
  The blank it was opened for is fixed: past `MAX_CANVAS_DIM_PX` a display draws
  at reduced resolution rather than asking for a viewport its target cannot hold
  (ARCHITECTURAL_LIMITS.md §"A canvas past `MAX_CANVAS_DIM_PX` renders wrong,
  not smaller"). What is left is a resolution falloff above ~4096 CSS px on a
  retina panel and ~8192 at dpr 1, which is invisible in practice. A clamp in
  `TrackHeightMixin` is the wrong shape anyway — MAF scrolls its overflow into a
  viewport and the multi-row painting divides the cap across rows — so the
  honest version is a per-display-type decision repeated across displays, for a
  handle that stops at a different place on every monitor. Reopen only if the
  falloff is reported.

- **`defineDisplay`: a track type as a spec, a mark as a shape plus channels, and a
  declared settings table under them** (ADR-089, ADR-090, and the branch that
  tried the table; also `ideas/a-track-type-is-five-primitives`, the proposal
  behind all three) — all rejected on 2026-08-24 and removed from the tree,
  [ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md).
  The factory was gauged on `example-plugins/score-example` (two settings, no
  layout, one mark) and then tested on an in-tree display: `LinearManhattanDisplay`
  fit only through six spec fields that were each an override hook with one
  consumer, a ~478-line imperative `extend` and an RPC serialization the spec
  could not hold, and it put a spec's chrome and drawing onto the gwas plugin's
  startup path because a state model is eager — 34 modules and 216,947 bytes of
  source, re-derived in ADR-091's Context from the commits that landed. The
  data-only settings table left behind eliminated 0 of 60 declarable getters,
  derived a correct fetch payload on 1 display in 6, and gave every shared
  setting a second owner. A spec that holds a display's wiring and nothing else
  is not worth keeping for third parties either: they get the same hand-composed
  stack the in-tree displays use, through the published subpaths, which is what
  `score-example` shows again. Its four config-read fixes were salvaged onto
  main. The port and the table were measured on a branch called
  `worktree-manhattan-lazy-spike`, which this file and ADR-091 both cited as
  "the record" and which exists nowhere — so every figure above except the
  closure is unre-derivable, and ADR-091 marks each one.

- **Lift `PileupMark` (`plugins/alignments/src/features/mark.ts`) into a shared
  package so MAF's per-base cells or the multi-sample variant cells declare
  their marks through it** — declined 2026-08-29 at the census, before a line
  moved. The contract cures main-thread triple-spelling: three files walking
  per-instance arrays with independently written predicates and gates. Neither
  candidate has that disease, and each holds parity by a mechanism that is
  *stronger for its data shape*. MAF has no per-instance index space at all —
  its Canvas2D painter walks block × row × sampled column off block byte data,
  its GPU encode run-length-merges same-coloured cells (instance count = colour
  transitions, `mafInstanceBuffer.ts`), its hit test is row/column arithmetic
  (`mafHitTest.ts`), and the shared declaration is the colour resolve
  (`resolveCellPacked`) plus the geometry mappers; materializing cell instances
  for `rows(data)` would allocate per base and destroy the run merge. Variants
  resolves everything once in the **worker** (`computeVariantCells`) and every
  consumer — GPU, Canvas2D, and by documented design the hit test
  (`findCellIndex` reads the render arrays "so the hit-test cannot disagree
  with what is on screen") — reads the same shipped arrays: `alpha` is
  pre-resolved packed ABGR, `hittable` is absence from the array, `selects` is
  a paint-order bucket reorder not a selection, matrix-mode x is feature-index
  with no per-cell `startBp/endBp`, and adopting `findMarkAt`'s linear row scan
  would regress the binary search that replaced a 16-byte-per-cell spatial
  index. So a lift would move the type and neither consumer — the
  member-only-one-display-exercises kill condition, twice. What a re-proposal
  has to bring: a display whose pack, paint and hit test are written separately
  on the MAIN thread over per-instance arrays, with per-frame gates
  (`alpha`/`hittable`) that cannot be worker-resolved — that display has the
  disease the contract cures, and admission is ADR-090's surviving clause, a
  second consumer's pull. The remaining `PileupMark` work is in-plugin
  (`ideas/one-mark-declaration-per-feature.md`: the `point`-on-a-bp-edge shape
  for insertion + clip), not cross-display.

- **A query language for the SV inspector's search** — proposed as
  `ideas/sv-search-language.md`, and closed 2026-08-16 by giving the grid two
  columns instead. The complaint was real: a search matched the spreadsheet's
  columns, so it found variants that NAMED a chromosome and missed the ones that
  merely reached it, because a breakend's far end lives inside the ALT string
  and no column carried it. A `Mate` column carries it now, and searching
  `chr5` on the C-GIAB benchmark returns 13 rows — the 12 whose own CHROM is
  chr5, plus the one whose only chr5 is its mate, which is exactly the record
  the old search could not reach.

  What is left of the proposal was already there. The grid's own filter panel
  has per-column operators and an AND/OR selector, `SV size` is a numeric column
  so a length range is `>` and `<` on it, every INFO field is already a column,
  and the type dropdown names classes. So the language would have been a second
  query surface competing with one that ships with the table — a parser, an
  evaluator, error reporting and docs, to reach what two `valueGetter`s reach.

  **The lesson generalizes**: when a table cannot answer a question, ask what
  column is missing before designing a language over the columns it has.


- **A zoom fade on the large-insertion count** — shipped, then removed
  2026-08-16. It ramped
  `labelFadeOpacity(length * pxPerBp, LONG_INSERTION_TEXT_THRESHOLD_PX)`, by
  analogy with the deletion length label beside it. The analogy does not hold. A
  deletion's fade compares the grey rect's width against the text that has to fit
  inside it — two widths of the same rect — whereas **an insertion consumes no
  reference bases**, so `length * pxPerBp` is a notional span the digits never
  occupy, and the box they do occupy is `textWidth(length)`, by construction
  exactly the room they need. So the room was never in question and the ramp
  measured how big the insertion is while wearing legibility's clothes, which is
  how it came to rest at 5% on a box with space to spare. It also **lagged the
  box it was drawn in**: `insertion.slang` widens the marker from a 5 px bar to
  22-40 px at 15 px of span, and the fade cleared the drop threshold at 17.03 px,
  so a window of zoom drew a wide empty box — and nothing softened that pop,
  since `insertionSizeAlpha` is `sizeAlpha`, which is 1 for any span above 1 px.
  Both now key on the shader's own `isLarge`, pinned by "the count appears at
  exactly the zoom its box widens at" in `computeVisibleLabels.test.ts`. **What
  stays faded:** the deletion length, whose rect is the deletion's true span and
  grows continuously — floored at `LABEL_FADE_FLOOR` so no still frame or SVG
  export rests on illegible digits. **Reopen only for** a fade against something
  an insertion actually has a width of.

- **Porting the canvas display's `scrollExtentMaxY` narrowing to the pileup** —
  measured 2026-08-16 and declined. `e122978eaf` narrowed the canvas feature
  display's scroll extent to the deepest row an **on-screen** feature occupies,
  because the fetch buffers half a screen either side and the pack places every
  buffered feature, so the scrollbar and the edge shadow offered a scroll onto
  blank canvas. The pileup looks like the same case on paper and is not: it lays
  out over `loadedRegions` too (`groupLayoutContext`), and its `heightMode`
  defaults to `fixed`, which scrolls — so the mechanism is present on the default
  configuration. It just costs nothing.
  `browser-tests/probe-pileup-scroll-extent.ts` compares the deepest row reached
  by a read intersecting the visible span against the group's laid-out `maxY`
  over five volvox loci, including a window at the covered region's edge:
  **wasted extent is 0 px in every case**, with 47-63% of the laid-out reads
  off-screen (`210/393`, `229/440`, `330/525`).
  **Why the analogy breaks:** the canvas case is *sparse* — 8 genes can pack 20
  rows deep, and one off-screen gene owns a whole row nothing on screen uses. A
  pileup row is shared by many reads, so an off-screen read almost always lands
  in a row an on-screen read occupies too, and the two maxima coincide. **What it
  would have cost:** a per-read scan of `readYs`/`readPositions` per pan settle,
  in the display where that walk is largest, plus a design call the canvas
  display never faced — in grouped mode the blank at an interior section's bottom
  is real layout you must scroll through to reach the sections below, so only the
  *last* section's trailing blank is wasted, and narrowing per-group `maxY` would
  move every band position. Reopen only with a dataset where the probe prints a
  non-zero column.

- **A clustering tolerance inside `arcKey`** — measured 2026-08-14 and declined,
  after being proposed twice: once so the arc band would agree with the sashimi
  overlay's 10 bp window, once on the worry that a real fusion's support splits
  across the aligner's microhomology jitter. On the hosted K562 Iso-Seq BAM (579
  records over the figure's chr22 window) the split is **26/1/1/1** — one
  dominant arc at the canonical e14a2 acceptor with three singletons within
  20 bp, inside two screen pixels and under its own stroke. **What was given
  up:** two reads of support, for a change to `arcKey`'s exact-coordinate rule,
  which the whole coalescing story rests on. A split read knows its breakpoint to
  the base; what it doesn't know is which base the aligner picked inside the
  microhomology, and that ambiguity is smaller than the ink. Mate pairs are the
  opposite case and already handled: they straddle a breakpoint rather than
  landing on it, so `clusteredInterchromSupport` counts over a window — a support
  FLOOR, not a merge, and it never invents a position. Numbers in
  [DEMO_DATASETS.md](DEMO_DATASETS.md).
- **A second junction producer under the coverage band (`showSplitJunctionArcs`)**
  — built, reviewed against main 2026-08-14, and declined once the arc band drew
  what the overlay had been built to draw. It clustered split junctions within
  10 bp and took the modal site, where `arcKey` coalesces on exact coordinates,
  so at a junction with microhomology jitter the two printed different counts at
  one locus. `cancer_sv/k562_bcr_abl_split` is published off the band alone: it
  draws the 154-read intronic acceptor and the 26-read ABL1 exon-2 one as
  weighted arcs across the region dividers, and both paths dedupe per readId, so
  the counts agree. **What was given up:** the printed count label and the
  position over the coverage band. The label is a later option on the band
  itself, sourced from `ComputedArc.support` — one producer, serving
  same-chromosome junctions too, roughly 60-100 lines reusing `SashimiArcLabels`'
  halo constants — and it is not a reason to keep a second producer alive
  meanwhile. The code is parked on `origin/parked/split-read-sashimi-arcs` and
  would still cherry-pick: the three unlanded commits (`cfeeb76274`,
  `2053dc0e6b`, `0775fa61b4`) sit on the merge base and the files they touch have
  no churn since except `model.ts` and `tooltipUtils.ts`. Expect a confusing
  branch: it is 8 commits ahead of main, of which four are the interchromosomal
  arc work that has landed under rebased hashes and one is an obsolete handoff.
  Two differences the case for dropping it does not turn on, and a reader
  comparing the two should not mistake for regressions: the branch's overlay was
  **not** gated on `readConnections`, and it tinted each arc by connection type
  where main paints every interchromosomal arc one `ARC_COLOR_INTERCHROM`, on
  purpose.
- **A clustered read-support floor for SAME-CHROMOSOME discordant arcs** —
  measured 2026-08-13 and declined, having been proposed as the obvious twin of
  the interchromosomal one that shipped. Windowed support genuinely gathers there
  — 257 clusters at W=0 become 109 at W=600, apparent support 24, 14, 10, 9, 9 —
  and every one is an artifact. Their |TLEN|s are a smooth continuum starting at
  the band's cut, which is a distribution tail being sliced; a real 4 kb deletion
  would put twenty pairs at ~4600 ± 100. The clusters are **density**: at 300x a
  600 bp window holds ~1200 pairs, so a fraction of a percent of tail yields
  several flagged pairs per window and single-linkage chains them. **What was
  given up:** nothing — it would have been a density filter presented as an
  evidence filter, growing more aggressive exactly where coverage is deepest,
  counting the tail the insert-size band floor already handles. The
  interchromosomal family does get the floor, because there the reads don't
  cluster at all (852 of 868 dropped) and the window exists only so a real
  translocation isn't deleted with them. Working in
  [DEEP_COVERAGE.md](DEEP_COVERAGE.md).
- **Colouring an arc long-insert from the pair's drawn SPAN** — shipped, then
  removed. `getArcColorType` overrode the TLEN class whenever the mates sat more
  than `LARGE_INSERT_THRESHOLD` apart, on the sound ground that a discordant pair
  often carries an unreliable or 0 TLEN. The read fills never had the rule, so
  the two disagreed on exactly the pairs it existed to catch:
  `classifyInsertSize` sorts TLEN 0 into `normal`, so those arcs went red over
  grey reads, and a figure shipped that way. Half the test was also
  `absrad >= longRangeThreshold`, a median+MAD cut over the arcs IN VIEW, so an
  arc's colour depended on what else was on screen and changed as you panned.
  **What was given up:** pairs whose TLEN is 0 or wrong are `normal` on both
  sides rather than long-insert on one. Restoring it means giving the READ path
  the same span rule — a worker-data change, since it has no mate span today —
  not reintroducing it on the arc side alone. See
  [ALIGNMENTS_COLOR_PARITY.md](ALIGNMENTS_COLOR_PARITY.md).
- **Unified GPU/Canvas2D "layer manifest" draw dispatch** — declined 2026-06,
  then **overturned band by band**, and the shape of the mistake is worth having.
  The decline read: layers aren't 1:1 across backends — `PASS_CLIP` is one GPU
  pass but two Canvas2D calls, coverage is individual passes vs one
  `drawCoverage` wrapper, mismatch is one gate over three passes — so uniform
  rows need shims that add back what the table removes.

  Every clause is true and none of them was the question. A manifest is **two**
  maps over one list of ids, not one table of uniform rows: a shared list holding
  the z-order and the gates, and a `Record<LayerId, …>` per backend free to
  resolve an id to whatever that backend needs. `PILEUP_LAYERS` landed on exactly
  that afterwards and the "disqualifying" clip shim is two lines inside one
  record entry. `COVERAGE_LAYERS` followed in 2026-08: the `drawCoverage`
  wrapper turned out to hold five calls mapping 1:1 to the five passes, under
  gates that already agreed — so what the entry described as a structural
  mismatch was two statements of one list, which is what a registry is for.

  **The lesson is about what "not 1:1" licenses.** It argues against collapsing
  the CALLS; it says nothing about sharing the LIST, and the list is where drift
  costs correctness — a coverage pass added to the GPU registry compiled clean
  and silently vanished from Canvas2D and the SVG export for as long as this
  entry stood. Read a "not uniform" claim as naming the layer it is true at.
  [draw-pass-registries](../mechanisms/draw-pass-registries.md) carries the
  precondition that settles the next case without re-arguing this one.

  **What survives:** the asymmetry inside the coverage band is real and was not
  erased. Four layers scale to the depth domain and one does not, and forcing
  the fifth to take a scale it ignores would have blanked the indicator
  triangles for the half-second the autoscale is debounced. The record's entries
  differ; the list they are keyed on does not. Arcs stay unshared for a
  different and still-good reason: the band is four GPU passes against one
  `drawArcs`, and the split is a GPU buffer-per-shape artifact rather than a
  layer list — the Canvas2D path already mirrors `ARC_PASSES`' order and
  `flatPaintOrder.test.ts` pins it.
- **Collapsing `features/*/uploadGpu.ts` into one table-driven upload** —
  declined twice, then **overturned**, and how the decline went wrong is the
  useful part. The standing argument was that the 16 wrappers hold the per-pass
  instance count and it is *not derivable from the buffer*: `gapPositions.length
  / 2`, `mismatchPositions.length`, `numInsertions`, `coverageGpuBinCount`
  (bin-capped, so decoupled from `coverageDepths.length`). A wrong count is a
  silent GPU mis-render — no throw, no test failure, geometry read off the end.

  **That premise was false, and the entry contained its own refutation.** The
  counts are not derivable from any *other array*, but they are exactly derivable
  from the *buffer*, because every packer allocates `n * INSTANCE_STRIDE_BYTES`
  from the same `n`. So `buf.byteLength / pass.instanceStride` is the count, for
  all 17 passes. The entry even cited `curvedArcCount` as proof the wrappers were
  needed — "a second subtraction that agreed with the packer was not good enough"
  — which argues for **zero** statements of the count, not two with a comment
  between them. Read a "not derivable" claim as naming what it was derived
  *from*: swapping the source silently swaps the claim.

  **What landed instead** (`InstancePass`): the pass descriptor carries its own
  packer, `uploadPass` takes the count off the bytes, and the wrappers, counts
  and `if (n > 0)` guards are gone — 776 lines, 17 files. The one objection that
  survived every round was co-location, and it is satisfied rather than traded:
  the packer never leaves its feature directory, and there is no count beside it
  to keep in agreement. The separate lesson from the declines predates this and
  still holds — a table over layer *ids* closes a wiring gap, which is why
  `GPU_PILEUP_PASS` is keyed on `PileupLayerId` rather than a flat list. See
  GPU_RENDERING.md § "Keeping the two backends in parity".
- **Mirrored-band strand-split coverage** — rejected across three passes.
  Group-by-strand already splits SNPs: `buildGroupResult` runs the coverage
  pipeline per group, verified in-app 2026-08-05 (volvox_bam,
  ctgA:14427-14534). Nothing left to build.
- **Coverage-weighted alpha for sub-pixel variant cells** — rejected; the 2px
  opaque floor stays. Ramp is legible over ~1-4 variants/px and >99% saturated
  by 12, while whole-genome cohort zoom is 3,000-31,000/px. Any alpha < 1 blends
  alt toward ref (`#e41a1c` → `#d77c7d`, ~55% contrast lost). If revisited, the
  lever is worker-side binning at fetch bpPerPx, not compositing.
- **Canvas2D glyph atlas for alignment labels** — 3x worse than `fillText`,
  which is ~85% of `drawAlignmentLabels` at ~1µs/glyph. At the floor.
- **`content-visibility: auto` for LGV scroll-zoom** — measured regression. CSS
  is ~33% of frame on GPU backends vs ~3% on canvas2d, so CSS levers look more
  attractive here than they are.
- **Re-tessellating the synteny clicked outline as chords** — up to 11.7px off
  the bezier. Outline passes reuse the fill polygon and clip analytically.
- **Folding synteny's `ColorByLegend`/`SVGColorByLegend` onto core's
  `LegendSpec`/`SvgColorLegend`** — core already carries three legend families;
  the fold doesn't collapse them.
- **Capture-phase rubberband listeners** — `capture: true` was a debugging
  artifact. Bubble phase works.
- **`overlay` subfeature labels as the compact-mode replacement for `below`** —
  rejected 2026-08-11 on measurement. It looks free (overlay reserves no
  vertical space), but overlay puts the label's top at the box's top and the two
  shrink on different curves, so in superCompact a 7.15px label sits on a 3px box
  and spills ~4px onto the transcript below. It trades a fixed overlap for an
  unfixed one. The overlap itself is a live question —
  [ideas/overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes.md](../ideas/overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes.md).
- **Making the canvas `featureItemMap` first-wins to match `indexById`** — tried
  2026-08-11 and reverted. The two tables resolve a region-spanning feature
  differently on paper, but `laidOutDataMap` is the LAID-OUT map and the packer
  gives such a feature one row across its whole ref-group, so both copies carry
  identical geometry before either table is built. A test written to catch the
  difference passes against both spellings. The existing comment had already
  reached that conclusion deliberately.
- **Co-locating each canvas glyph's layout and emit in one `{layout, emit}`
  module** (a `Record<GlyphType, Glyph>` registry) — proposed as
  `ideas/canvas-glyph-system.md` after the 2026-07 emit-dispatch unification,
  and closed there. Four grounded reasons, so don't re-litigate without new
  information. **(1) A real one-way layer boundary.** `glyphs/` (layout) imports
  *zero* rendering deps — no color, theme, peptide or Collector, only `Feature`,
  `types.ts` and geometry helpers — while `glyphEmitters.ts` is saturated with
  them (~41 refs). They communicate purely through the `FeatureLayout` tree plus
  the `glyphType` tag, and layout output (heights) feeds main-thread row packing
  *before* emit runs. That is a genuine phase split, not incidental file layout,
  and co-location forces every glyph module to straddle both worlds. **(2)
  Detection stays centralized regardless.** `findGlyph` is a precedence-ordered
  decision tree (`guide_rna` → CDS+mature → repeat → containerTypes →
  container-children → CDS-child → segments → box) — routing logic about
  relations *between* glyphs, inherently central — so "everything about a glyph
  in one file" is unachievable anyway. **(3) It reintroduces the indirection
  just removed.** A registry brings back the `Record` and makes `Subfeatures`'
  recursion dispatch *through* it (`GLYPHS[child.glyphType].emit(...)`) instead
  of a visible recursive call; two readable switches beat a registry of paired
  objects calling back into the registry. **(4) No drift pressure to relieve.**
  Adding a glyph touches `types.ts`, `findGlyph` and one `emitGlyph` case, and
  the `never`-default makes a missing emit case a compile error — the compiler
  already enforces the coupling proximity would. The remaining two dispatches
  are two different concerns in two layers, not the redundant dual-dispatch over
  one thing that the old `GLYPH_EMITTERS`/`processSubfeaturesLayout` pair was.

  Skipped with it as lateral: collapsing the five one-line layout wrappers
  (`box`/`segments`/`processed`/`crisprGuide`/`repeatRegion.ts`) into a layout
  `switch` symmetric with emit — it trades small dependency-free files
  (preferred) for a switch with no correctness or drift benefit.

  See [draw-pass-registries](../mechanisms/draw-pass-registries.md) §"Where it
  stops" for why this is a different argument from the shared-pass-list rule,
  and
  [ADR-075](../architecture-decision-records/adr-075-the-isoform-cap-runs-in-the-worker.md)
  for the isoform-cap placement the same doc got wrong — except it turns out it
  did not: the placement it argued for is where the trim lives now
  ([ADR-092](../architecture-decision-records/adr-092-isoform-trimming-is-a-rung-of-the-fit-ladder.md)),
  and what the doc got wrong was the cost of building it there.
- **A view-space GPU pass for the cross-region arcs** — designed in full as
  `ideas/cross-region-arcs-view-space-pass.md`, then closed as a contingency
  nobody is going to reach. The idea is sound: pack the cross-region arcs against
  layout pixels instead of bp, set `blockStartPx`/`blockWidth`/`bpLo`/`bpLen` so
  the shader's "bp" axis *is* layout px and `canvasW` is the view's width (so
  `arcIsFar` is asked once per mark rather than once per block), scissor to the
  band over the whole canvas, and `arc.slang` runs unmodified. The axis
  substitution is legal because displayed regions lay out contiguously —
  `calculateDynamicBlocks.ts` advances by `regionWidthPx` with no inter-region
  padding except at the two boundary blocks — which is the same fact that makes
  the SVG overlay line up with the canvas today.

  What kills it is that the problem it solves is already answered twice over:
  `CROSS_REGION_ARC_CAP` is a floor under the frame rate, and the reader's own
  lever at real depth is better than anything the renderer can do —
  `drawProperPairArcs: false` drops 9138 of 9204 arcs on HG002 300x. Against
  that, the pass costs a repack on zoom, a second uniform-fill path, and a split
  of "drawn coordinate" from "reported coordinate" for the tooltip. Revisit only
  if a real set outgrows the SVG overlay with the cap already lifted.

- **Folding content staleness into `displayPhase`** — moved here from
  `ideas/zoom-perf-followups.md` 2026-08-24, having been costed and never taken.
  During a zoom an LGV display reports `ready` for ~600ms between fetches, which
  looks like a bug. It is not a stop-token handover artifact — supersede is
  gap-free by construction (ADR-080) — it is the fetch autorun's debounce, and
  in that window the display genuinely has data covering the viewport with
  nothing in flight.

  The tempting fix is to fold `isCacheValid` into the per-region
  `viewportCurrent`, so a display whose `regionFetchKey` has moved reads
  `loading`. **It would raise the loading scrim 250ms into every zoom**, since
  `visible = phase === 'loading'`, and delay every interaction-time readiness
  gate by the debounce. `zoomInvalidation.test.ts` and
  `displayPhaseWiring.test.ts` pin "ready through a zoom inside the buffer" and
  are the standing guard against taking this by accident.

  The comparative family *does* fold `dataCurrent` in
  (`comparativeReadiness.ts`), so the two families genuinely differ — a real
  inconsistency, and the LGV reading is the one with the scrim attached to it.
  **Reopen only** with a scrim that can distinguish "stale but showing data"
  from "nothing to show".

  **The EXPORT-gate fold was taken 2026-08-26, and it is not the fold this entry
  rejects.** `MultiRegionDisplayMixin` conjoined `isCacheValid` into
  `dataCurrent`, whose consumer on this family is `foundationSvgReady`, so an
  SVG export of a keyed display stops painting the previous zoom's data across
  the debounce plus the RPC. No scrim moved with it, and
  `zoomInvalidation.test.ts` and `displayPhaseWiring.test.ts` pin what they
  always pinned. Read that conjunct as this entry being reopened and you will
  delete a fix; the entry stands for the phase.

  **`dataSuperseded` went into the phase 2026-08-26 and is likewise not this
  fold.** `displayPhase` now takes `viewportWithinLoadedData &&
  !dataSuperseded`, because a display that opts into `dataSuperseded` is drawing
  its data wrong right now rather than merely about to: zooming alignments'
  perBaseLetter from 16 bp/px to 1 keeps the viewport inside the loaded region
  while the wall paints a 1 px stripe every 8 px for the whole
  debounce-plus-RPC window. That term is false on every display that does not
  override it, so it raises no scrim on an ordinary zoom, which is what this
  entry is about. **`displayPhase` still must not read `dataCurrent`**, whose
  `isCacheValid` term is exactly the 250 ms scrim rejected above — the one-line
  edit that spells the argument `dataCurrent` for symmetry with the export gate
  takes this fold by accident, and `displayPhaseWiring.test.ts` goes red saying
  so.

- **Gate the two per-base colour modes against the other backend** — built,
  measured, removed the same day (2026-08-27). The modes really were covered by
  nothing, and two scenes in `Alignments Color Schemes` closed that; both failed
  immediately, at **16.39%** on `perBaseLetter` and 1.76% on `perBaseQuality`
  against a 1.5% threshold. The disagreement is real, does not move between
  rasterizers, and predates the sub-pixel bin that prompted the look: the GPU
  snaps a cell to a pixel column and drops 10,553 one-pixel columns, Canvas2D
  leaves the edge fractional and averages neighbouring bases into colours no base
  has.

  **Declined on the cost of carrying it, not on the finding.** Neither mode is a
  common setting, nobody intends to make the backends agree, and holding the
  scenes needed an 18% override — a ceiling that would never come down, which is
  exactly what the 2026-08-05 override audit deleted seven entries for. The 1.6pp
  of headroom it bought over a 16.39% pair would have caught only a catastrophe.

  What a re-proposal has to beat: nothing about the picture, which is measured
  and written down. Bring a reason the modes now matter, or take the visual call
  first. Numbers, mechanism and the recipe to re-take it in one gate run:
  [CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md) §"The per-base wall".


## Config and MST

- **Give a pluggable element an `extendsType`**, so a display built from
  another's state-model factory inherits its extensions and `extendDisplayType`
  walks the chain rather than matching `element.name` exactly — proposed with a
  dev-mode check to flag an undeclared lineage, measured 2026-08-25 and
  declined. Three separate reasons, any one of them fatal.

  **The check cannot be built the way it was designed.** The premise was that
  `types.compose` preserves the base's property objects by identity, making
  "this model composes that one" detectable rather than heuristic. It does
  preserve them — `cloneAndEnhance` does `Object.assign({}, this.properties,
  …)` and `this.initializers.concat(…)`, both by identity — but a display's
  model comes from `factory(configSchema)`, and two calls of a factory share
  nothing that two unrelated factories do not. Measured over the real lineage
  and two controls: `LGVSyntenyDisplay` (79 initializers) against
  `LinearAlignmentsDisplay` (73), which it is literally built from, shares **1
  property (`id`) and 5 initializers**. `LinearBasicDisplay` (103) against
  either of them shares **the same 1 and the same 5** — they are
  `BaseDisplay`'s, the one module-level singleton every display composes. The
  base's initializers are not even a prefix of the derived model's. The signal
  is identical for a real parent and for no relationship at all.

  **In-tree it would have one user.** `LGVSyntenyDisplay` ←
  `LinearAlignmentsDisplay` is the only pair where a display is built from
  another *registered* display's state-model factory. Where displays do share a
  base it is an unregistered one with no name to declare —
  `linearCanvasBaseDisplayStateModelFactory` under `LinearBasicDisplay` and
  `LinearVariantDisplay`, `MultiSampleVariantBaseModel` under the two
  multi-sample variant displays, `SharedLDModel` under `LDDisplay` and
  `LDTrackDisplay`. Everything else composes `BaseDisplay` plus a mixin set
  directly — `TrackHeightMixin`, `MultiRegionDisplayMixin`, `LegendMixin`,
  `CanvasFeatureGateMixin`, `WiggleCommonMixin`, `TreeSidebarMixin`. The cost it
  was proposed to remove was one duplicated `addDisplayMenuItems` call in
  `LinearDerivativeVsRef`, and "one extension registration can name several
  element types" removed that instead, by letting `extendDisplayType` and the
  menu helpers take an array of names.

  **And it cannot express the case that motivates it**, which was out-of-tree
  plugins wanting to say "any canvas-family display" instead of naming one. The
  canvas family's shared base, `linearCanvasBaseDisplayStateModelFactory`, is
  one of the unregistered ones above, so `extendsType` has no name to point at —
  and `LinearMultiRowFeatureDisplay`, the other canvas display showing genes and
  the one those plugins actually miss, composes the mixins directly and would
  declare no parent at all. A name would not help them even if it existed: that
  display's `contextMenuInfo` is `{clientX, clientY, refName, pos, hit?}`
  against `LinearBasicDisplay`'s `{item, subfeature, displayedRegionIndex}`, so
  an extension written against one reads `undefined` on the other. The family
  they want is a shared
  menu-surface shape, and nothing in the tree declares one.

  What the plugins surveyed in `~/src/jb2plugins` hand-roll today is a raw
  `Core-extendPluggableElement` callback gated on
  `isDisplay(elt) { return elt.name === '…' }` — `LinearBasicDisplay` in
  protein3d, msaview, icn3d and graphgenomeview, `LinearAlignmentsDisplay` in
  tview, `LinearVariantDisplay` in both alphagenome plugins — and
  `addDisplayMenuItems` already answers it. None has adopted it yet, which the
  release timeline explains without anyone having been asked: `v4.3.0` has no
  `addMenuItems.ts`, so it is not reachable from a published `@jbrowse/core`.
  Adoption is the next move here, not machinery.

- **A `legendConfigSchemaFields` helper**, sharing the `showLegend` config slot
  the way `treeSidebarConfigSchemaFields` shares the tree ones — priced
  2026-08-17 and declined. The *accessors* did move that day: `LegendMixin` owns
  `showLegend` / `showLegendDisplayTypeDefault` / `setShowLegend`, which were
  character-identical in six displays (`LinearAlignmentsDisplay`,
  `LinearHicDisplay`, `LinearMultiRowFeatureDisplay`,
  `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `SharedLDModel`),
  and both ends of that were already shared — every one of the six builds its
  row with `showLegendCheckboxItem` and shows a `FloatingLegend`, so the triple
  was the middle link between two pieces of common code.

  **The slots are the half that genuinely differs, and it was checked rather
  than assumed**: `promotedBase` really does split three/three, each description
  names a different legend, and the "falling back to off/on" tail every
  description carries agrees with its own `promotedBase` in all six. A helper
  would therefore be parameterized on everything that varies and share one
  `type: 'maybeBoolean'` line. `showLegendCheckboxItem`'s docstring had already
  decided this and the mixin does not disturb it; re-proposing needs a reason
  better than symmetry with `treeSidebarConfigSchemaFields`, which exists
  because that set had actually drifted.

  The coverage lesson generalizes and is the reason to move accessors at all: a
  wrong `showLegend` was visible to two of the six displays. Hi-C, multi-row,
  multi-wiggle and LD had no test that would notice, so inverting the getter
  left all four green. One implementation collapses that to one place, and
  `LegendMixin.test.ts` runs the whole promotable cascade over both
  `promotedBase` values.
- **Sharing the row displays' `hierarchy` getter on `TreeSidebarMixin`** —
  re-priced 2026-08-18, after the toggles landed, and still declined. Four
  displays (`LinearMafDisplay`, `MultiSampleVariantBaseModel`,
  `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`) each spell one
  `computeClusterHierarchy(...)` call that differs only in which expression
  supplies the content height, plus multi-wiggle's `isOverlay` short-circuit.

  **The original objection dissolved and the answer did not change**, which is
  what makes this worth writing down rather than re-deriving. That objection was
  "three hooks it can't type"; the mixin now owns `root` / `treeAreaWidth` /
  `showBranchLength` and `sources` is already its contract, so it really is down
  to one hook.

  That one hook is the problem. It is `rowsContentHeight`, and the comment
  standing over that parameter in `clusterUtils.ts` exists to refuse exactly this
  move: pass the viewport a display's rows scroll inside instead of the height
  they add up to and the dendrogram still draws, still looks plausible, and names
  the wrong rows. Today each call site spells the product out under that comment.
  Behind a `treeContentHeight` hook the author implementing it sees the hook's
  name and not the warning — so the refactor relocates the one parameter in that
  package named to resist relocation, to save four lines.

  The row-height ladder next to it is deliberately unshared too, and two of its
  three differences look like drift and are not: canvas caps
  `effectiveRowHeight` at `maxCanvasHeight / nrow` because it sizes its canvas to
  its content; multi-wiggle has no `rowHeight` sentinel at all and branches on
  `isOverlay`; and maf and canvas seed the `height` slot in `setFitToHeight`
  where variants does not, because both of those *override* the `height` getter
  to a content-derived value, so `self.height` in fixed mode is not the slot and
  entering fit mode without re-seeding jumps. Variants leaves `height` to
  `TrackHeightMixin`, where the same line would write the slot back to itself.
  Check which `height` a display has before copying either. What IS shared is the
  part with an actual rule — `resolveRowHeight`'s `0` sentinel plus non-positive
  floor, the menu row and the dialog. See
  [ROW_HEIGHT_AND_FIT.md](ROW_HEIGHT_AND_FIT.md).

  **What this rejects is the computed ladder, not the config slots.** A
  `rowHeightConfigSchemaFields` following the `treeSidebarConfigSchemaFields`
  pattern is the shared half above and is endorsed, not blocked, by this entry —
  it is in flight on the `row-height-mixin` worktree. The three differences named
  here are the reason the *derived* values stay per-display.
- **A `createEmbeddedSessionModel({ view, tracksMixin, … })` factory** for the
  two single-view embedded products — measured 2026-08-16 and declined, in
  favour of the `EmbeddedSessionMixin` that shipped instead. The circular- and
  linear-genome-view session models are ~140 lines each and differ in four
  places, so parameterizing the differences is the obvious shape. **It cannot be
  typed.** `types.compose`'s overloads are declared over
  `IModelType<P, O, FC, FS>`; a model passed in as a naked type parameter has
  nothing to infer those four from, so the composed result degrades until
  `session.view` is **`any`** — and `any` is the one failure that leaves tsc,
  jest and lint green while switching off checking at every embedder call site.
  Three shapes were tried (trailing `.props()`, the prop inside a
  `types.model()` argument the way `createEmbeddedRootModel` takes its session,
  and widening the tracks mixin); all three produced `any`, so the placement is
  not the variable — passing a model type as a generic to `compose` is. What
  works is keeping every argument to `compose` concrete: the shared part is a
  mixin the product composes, and each product still spells out its own tracks
  mixin, `view` prop, and the `views`/`addView`/`removeView` members that read
  `self.view`. Pinned now by `AssertNotAny<IsAny<ViewModel['session']['view']>>`
  in each product's `createModel.ts`, so a retry fails loudly instead of
  silently. Note `createEmbeddedRootModel`'s own `SESSION` generic **is** fine —
  measured, not assumed — which is what makes the factory look safe.
- **Single-sourcing the `Feature.get` overload block** — tried 2026-08-16 and
  declined. Nine files restate the same eight-line overload list: the `Feature`
  interface and every class implementing it (SimpleFeature, Bam ×2, Cram, Sam,
  Vcf, NCList, Gff3, Synteny). They are **not** redundant — deleting the class
  copies breaks ~40 call sites, because a class whose only `get` returns
  `unknown` is not assignable to `Feature`, whose `get('refName')` returns
  `string`.

  Two ways out, both worse:

  - **Interface/class declaration merging** (`interface X extends Feature {}`
    beside `class X`) does not work at all. The class's own `get` declaration
    wins over the merged one, so the overloads never reach the class type and the
    same call sites break.
  - **An abstract base carrying the overloads** and delegating to a
    `protected abstract getRaw` does work, and puts a megamorphic call on
    `feature.get(...)` — which `plugins/alignments/src/CLAUDE.md` names as the
    per-read hot path to keep work out of, across eight implementations sharing
    one call site in the base.

  The copies are self-checking: a wrong one fails its own `implements Feature`.
  Verbose, safe, and cheaper than either alternative.
- **Deleting the constant-entry feature** (`isConstantEntry` →
  `volatileConstants` → `.volatile()` in `makeConfigurationSchemaModel`, and the
  `string | number` members of `ConfigurationSchemaDefinition`) — measured
  2026-08-15 and declined. It really is unused: **0 constant entries across all
  93 registered schemas**, read off the definition tables at runtime, not
  grepped. Kept anyway, because it is a plugin ABI surface — `isConstantEntry` is
  re-exported through `@jbrowse/core/configuration`, an external plugin can
  declare a constant with no in-tree trace, and removals on that surface fail
  quietly (`PLUGIN_ABI_STABILITY.md`). Roughly 15 lines and one type-union member
  is not worth that. The count is pinned by `ConfigSlotDefaults.test.ts`, so if
  one is ever added it shows up as a snapshot line rather than being re-derived.
- **Driving down the `check-config-read-types` number** —
  [ADR-052](../architecture-decision-records/adr-052-slot-name-safety-is-a-write-guard.md),
  which also declined the accessor codegen. Worth restating because the number
  reads as a backlog and mostly isn't: narrowing all nine widened display
  factories moved it by **6 reads**, 61% to 62% of the surface — both readings
  taken 2026-08-04, and the ADR carries the live table. Most of the residue is a
  handful of slot names, 77<!--m:config-read-gap-populations.track-or-assembly-schema.reads-->
  of the 131<!--m:config-read-type-gaps.source.unchecked--> unchecked source
  reads, and they are against the *track* or *assembly* schema, which the
  baseline groups under whichever display file contains them — so they look like
  display debt and no display narrowing can reach them. The split is in
  [TODO.md](../TODO.md)'s entry for the baseline; the baseline's own value is
  diagnostic (does narrowing *this* factory buy anything), not a target.
- **Runtime check that a config snapshot isn't a readable config** — impossible,
  and unnecessary: compile error since `16192aebdd`.
- **Extension-function chains replacing `self as typeof s & BaseSession`** —
  proven strictly worse. The cast is an equilibrium.
- **Full `session.tracks` snapshot-vs-model honesty migration** — deliberately
  not done. The brand distinction carries no slot safety.
- **Required `regionBpOffsets` prefix-sum on `ViewLayout`/`Base1DViewModel`** —
  works, and erases ~2.3ms of a 16.7ms frame (measured 2026-07-31, 3000 regions,
  viewport on the last: `calculateStaticBlocks` 1.94ms/call,
  `calculateDynamicBlocks` 0.33ms, `pxToBp` 0.11ms per mousemove). Rejected: it
  makes a derivable value a required field whose consistency with
  `displayedRegions` nothing can check, and drags ~90 call sites plus most tests.
  Shipped instead: a `break` past the window's right edge, fixing the head of
  the scan. A module-level `WeakMap` on the regions array is also out. Discuss
  before re-attempting.
- **A `regionStores` hook (or a scan) behind `regionHasData` /
  `clearDisplaySpecificData`** — parked 2026-08-20 as
  `ideas/per-region-stores-are-named-four-times.md`, closed 2026-08-21 by
  answering the question it parked on: the fail-open `regionHasData` default is
  **unreachable** from the byte gate. A refusal stamps nothing — the
  `fetchEachRegion` family skips refused results outright — pinned by
  `fetchRegions.test.ts` and
  `LinearBasicDisplay/loadedRegionCoverage.test.ts`. The one stamp-without-store
  path is sequence's legitimately-empty-region answer, where fail-open is
  load-bearing — a store-derived default would refetch an empty region forever.
  So `regionHasData` is a tier-selection hook (MAF) plus deliberate
  defense-in-depth (the two canvas `rpcDataMap.has` overrides, which decide
  which way a future commit/store drift fails), its default is right, and there
  is nothing for a hook or a scan to fix. The scan variant was also a check
  that cannot fail (`mechanisms/green-checks-that-cannot-fail.md`).
- **Migrate the alignments plugin from its positive-`bpLen`-plus-`flipX`
  reversal convention onto the tree's negated-`bpRangeX` pivot** (wiggle, MAF,
  variants, canvas, gwas, multi-row) — measured and declined 2026-08-28. 13 of
  the plugin's 14 pass shaders call the flip family (`flipX`, `flippedQuadPos`,
  `arcBandClipPos`), not the nine an earlier census counted, and the migration
  deletes a spelling, not a concept: `read.slang`'s chevrons stay strand-laden
  either way, so `u.reversed` survives regardless. The buy this was proposed
  for — joining `packedColorQuad.slang` to render-core's `rowRect.slang` —
  turns out to be blocked twice more even with the convention gone: `rowRect`
  doesn't pixel-snap where `pileupCellX` snaps both cell edges, and rowRect
  centers its band in the row where the pileup top-anchors it, a 0.5px shift
  every Canvas2D twin and hit test would have to follow. `MIN_DRAWN_ROW_PX`
  buys nothing today either, since fit mode floors the pitch at 1 CSS px and
  scrolls instead of going sub-pixel.

  The risks are concrete and none of them are covered: under negation, gap's
  midpoint-widening collapses a wide reversed deletion to 1px, overlap's
  signed width fades every reversed overlap invisible, and read's
  chevron/outline geometry is direction-laden throughout. Existing reversed-
  region test coverage is real but sits almost entirely on the Canvas2D side
  (`reversedMirror.test.ts`, `cellPainterParity.test.ts`, the per-feature
  `markParity.test.ts` suites) — not one test on any backend evaluates an
  alignments shader with `u.reversed = 1`, and the cross-backend parity gate
  can't stand in for that: both backends read the same genomic field, so a
  missing flip is missing identically in both and the differential sees two
  agreeing wrong answers. Neither convention dominates in general — the
  negated pivot suits orientation-free rect grammars, the final-mirror suits a
  plugin where 5 of 13 passes carry direction or asymmetric geometry — so this
  is a second-convention documentation cost the tree already pays, not a
  defect. Reopens if run-merged per-base cells give the 1bp pileup cell an
  explicit span (dissolving the `pileupCellX` snap blocker for just the two
  cell shaders — see
  [ideas/per-base-wall-at-wide-zoom.md](../ideas/per-base-wall-at-wide-zoom.md)),
  or if a GPU-side reversed-mirror gate exists first to make the interior
  audit testable.

- **Region-too-large gate in render-core** —
  [ADR-045](../architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md),
  [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md).
- **Deeper Option A/B refactor of config quick-edit base-node mutation** — closed
  via
  [ADR-032](../architecture-decision-records/adr-032-track-config-nodes-are-throwaway-views.md)
  plus the `writeDelta` choke point. Not a bug.
- **A throw in `fullConfSnapshot` for arrays/maps of sub-schemas** — declined in
  the 2026-08-09 audit of `packages/core/src/configuration`, matching the
  `assertNoPromotableSlots` treatment three lines below it. Those are dropped
  because "nothing has needed them"; a config that does carry one is silently
  fine today and a throw would break it at the first worker payload. Establish
  that no display config carries such a slot before converting silence into a
  throw. Related negative result, already paid for: dropping `type` and the
  identifier from a display snapshot breaks no consumer — grepped
  `displayConfig.type` / `displayConfig[` across `packages`, `plugins`,
  `products`, and the one production call of `getConfigSnapshotWithPromotables`
  is `plugins/canvas/src/LinearBasicDisplay/baseModel.ts`, which reads neither.
- **The config editor enumerating slots off the registry** instead of
  `getMembers(schema).properties` (`ConfigurationEditor.tsx`) — declined in the
  same audit. It is the last reader of slot structure going through MST
  reflection rather than `getConfigurationSchemaDefinition`, which
  `schemaRegistry.ts` calls "the single accessor". Row order *should* survive
  the swap, since `modelDefinition` is built by iterating the definition and
  just prepends `type` and the identifier, both of which render as null — but
  that is reasoned, not run, and the panel has snapshot tests. The payoff is
  tidiness, so the check has to be worth it.
- **A global `Tools → Sign out...` menu item** — built and backed out (2026-08).
  A dialog listing every account holding a credential, with
  `signOut()`/`hasCredential()` seams on the base internet-account model and a
  `signOut()` override on the OAuth account to drop the refresh token too
  (dropping only the access token silently signs the user back in on the next
  read — that part is real and worth keeping if this ever returns). Rejected as
  overfitting: authentication is rare, and a permanent top-level row in every
  install to serve it is disproportionate. Apollo — whose product *is*
  authenticated — already has its own `LogOut.tsx`; their having built one is
  evidence about Apollo, not demand here, and reading it as demand is the
  mistake to avoid repeating. Without a caller the `signOut()` seam is another
  unused extension point, which is what `SelectorComponent` and
  `getValidatedToken` were deleted for. If it earns its place later, the
  contextual spot is the FileSelector beside the account toggle you just picked,
  not a global menu. See [../ideas/internet-accounts.md](../ideas/internet-accounts.md).

- **Keying `dataAdapterCache` on `(adapterConfig, sequenceAdapter)`** — proposed
  twice as the fix for `setSequenceAdapterConfig` being set-once, so that an
  adapter config displayed against two assemblies gets one instance per
  reference instead of taking whichever call primed it first. Costed 2026-08-19
  and declined: **7 of the 14 `getAdapter` call sites pass no sequence adapter
  at all** — `CoreGetSequence`, `CoreGetInfo`, `CoreGetMetadata`,
  `CoreGetRegions`, `CoreGetRegionByteEstimate`, plus the hic, maf, variants and
  gwas RPCs — because they have no assembly context and legitimately don't want
  one. Under a compound key each of those forks a *second* instance of the same
  file: `CoreGetRegionByteEstimate` runs on every fetch as the byte gate, so a
  BAM would carry two adapters and two index downloads for the whole session.

  The problem it solves is also smaller than it looks. `renameRegionsIfNeeded`
  resolves one refName map per unique assembly through `Promise.all`, so a
  multi-assembly fetch can prime one instance twice with two different configs —
  but the adapters fetched that way are the comparative ones (PAF, chain,
  dotplot), and none of them ever reads `sequenceAdapterConfig`. No adapter that
  reads the reference is fetched across two assemblies. Making the conflict
  loud instead was costed and declined with it: it would throw on the
  comparative path, which is doing nothing wrong.

## Performance and measurement

- **Retire the stop-token blob URL, so a zoom stops minting one per fetch
  rotation** — sized and declined 2026-08-30, by the count
  `ideas/zoom-perf-followups.md` prescribed doing first. The profile books ~100ms
  of main-thread self time to `createObjectURL` on a ~7s gesture, which is worth
  chasing only if the mints are numerous. They are not: a 20-frame zoom over four
  tracks mints **8**, counted twice over — once by spying the module export, once
  by installing a counting `URL.createObjectURL` (jsdom has none, so every token
  under jest is otherwise a `nanoid` and the browser branch never runs).
  `products/jbrowse-web/src/tests/ZoomStopTokenMints.test.tsx` is the count.

  The rate is per fetch ROUND, not per frame, so jsdom's round count is not the
  browser's — but the conclusion does not depend on getting that right. Even
  extrapolating to a few hundred mints a gesture puts `URL.createObjectURL` at
  0.3ms a call, and at the measured rate it is 12ms; a registry insert is neither.
  So the ~100ms frame is not the mint, and the `syncProbe` opt-in that file
  designs — an enumerated call-site list, a rotation option, ~27 probe-dependent
  sites to audit — buys whatever the sampler is really folding into that frame,
  which is unknown. Measure what the frame contains before designing against it.

- **Raise the RPC worker ceiling so a sixth alignments track gets a sixth
  worker** — declined 2026-08-25: the contention it would relieve was measured
  not to exist. `WebWorkerRpcDriver` sizes its pool
  `clamp(detectHardwareConcurrency() - 1, 1, 5)` and `rpcSessionId` is
  per-track, so a six-track session puts two tracks on one worker — but tracks
  do not serialise there, and every RPC worker profiles 100% idle through a
  six-track pan, so there is no queue for a sixth worker to drain. The cost side
  is real and one-directional: each worker holds its own BAM chunk caches and
  its own bgzf pool, so a sixth is a sixth copy of both (see
  `ideas/give-the-rpc-workers-one-inflate-pool-and-one-byte-cache-between-them`,
  which is where the memory question lives). A reader who wants more workers already
  has the lever — the `workerCount` config slot overrides the hardware default —
  so nothing is owed but the default, and the default is right.

- **A `timeout` on an RPC call, and a deadline on the worker boot handshake** —
  built 2026-08-25 and reverted the same day. The mechanism worked and the
  design questions it settled were the real ones: no default is possible,
  because an RPC's reply IS its work and a blanket deadline is the same mistake
  as bounding a range read's transfer rather than its response; and a deadline
  cannot ride beside the caller's stop token, since the wire carries one per
  call, so it has to mint its own and forward the caller's stop into it. What
  none of that survives is **who is waiting**. This is a browser app, so the
  user's recovery — close the tab, reload — is faster and more reliable than any
  deadline, and it is what they already do. A server has to bound a wait because
  nobody is watching; a page does not. That leaves an opt-in mechanism with no
  callers paying maintenance surface in `BaseRpcDriver` for a failure someone
  else fixes in two seconds.

  The concrete hang it was aimed at is real and still there:
  `WebWorkerRpcDriver.makeWorker` resolves on `ready` and rejects on an
  `ErrorEvent`, so a worker that loads and then goes quiet (a module import that
  never settles) hangs its boot promise and every call routed behind it. Judged
  not worth a mechanism — it needs a bug nobody has hit, and the reload clears
  it. **Reopen only if** it is reported, or if a non-browser consumer (a node
  embedder, a CI harness) grows where no one is at the keyboard.

- **A one-pass binary-search partition for `aminoAcidsInRange`** — proposed
  2026-08-20 and declined, because the disjointness it needs is not true of the
  data. `aminoAcidsInRange` filters the whole residue list once per cleavage
  product, so a SARS-CoV-2 ORF1ab (~16 products, ~7,100 residues) costs ~114k
  comparisons to make ~7,100 assignments. Replacing it with one pass over the
  residues plus a binary search into the product ranges measured **2.27ms ->
  0.43ms** on that shape.

  It is wrong. Mature protein regions **overlap**: a precursor and the products
  it is cleaved into are both annotated as siblings, so one residue belongs to
  several of them. `collectRenderData.test.ts` §"shows residues independently
  for an overlapping precursor and its products" is the enterovirus case — VP0
  spans VP4 and VP2 — and it goes red immediately, because a search that returns
  the one containing range gives VP0 nothing.

  Note also that the residue list cannot be searched directly whatever the
  ranges do: it arrives in transcription order, which is `startBp` DESCENDING on
  the minus strand.

  An overlap-aware version is still O(products x residues) in the worst case and
  keeps the same per-residue work, so it buys little of the 1.8ms. Left alone.

- **A scratch rect for the off-screen mate hit test** — measured 2026-08-20 and
  declined, because it moves the cost onto the hotter of the two paths.
  `offscreenMateRectAt` allocates a rect per alignment and `offscreenMateAt`
  throws each one away, once per alignment on every pointer move inside the
  strip — the `makeCornerScratch` case exactly, and the strip hover is
  allocation-dominated (15.6ns per mark before, 7ns after). Two shapes tried,
  `offscreenMateOverlay.bench.ts`, three interleaved samples each, controls
  0.96-1.04, mins on the reliable rows:

  - a `{x, width}` scratch the draw copies into a rect literal — strip hover
    0.039 -> 0.019ms (demo), 0.78 -> 0.35ms (50k); **repaint 0.297 -> 0.439ms
    and 4.96 -> 6.00ms**.
  - the scratch IS the rect, pushed on a hit and replaced — same hover, repaint
    0.297 -> 0.370ms and 4.96 -> 5.56ms. Better, still a regression.

  **The repaint runs on every pan frame and the strip hover only when the
  pointer is on six pixels of the band**, so 12-25% on the first does not buy
  50% on the second. Both shapes lose on both fixtures that measure reliably;
  the 250k row read faster with the scratch, and that row's own spread
  (23.6-52.4ms across these samples, on untouched code) is wider than the
  difference. What would actually pay is not allocating rects at all — flat
  `xs`/`widths`/`ids` arrays for the whole lane — and that is a rewrite of
  `labelRuns` and `placeLabels`, which read the rects, not a draw-loop change.

- **Interning the refName column in `parseBed`** — measured 2026-08-20 and
  declined. jcvi's grape BED holds 33 distinct scaffold names over 55,564 rows,
  which is the shape interning is supposed to be for, and it lost on both
  counts: a `Map<string, string>` lookup per row cost 28% (35.6ms -> 46.0ms),
  and the heap delta across four alternating measurements was noise in both
  directions. The strings it deduplicates are short enough that V8 allocates
  them flat, so a second reference to one saves nothing, and JS string equality
  is by value — meaning the win it was supposed to hand downstream (a pointer
  compare in the synteny worker's string dictionaries) is not observable from JS
  at all. The reasoning is kept at the arm it is not, in
  `plugins/comparative-adapters/benches/mcscanParseBed.bench.ts`.

- **Parsing a PIF row straight into its `PifLine` shape, skipping the
  `PAFRecord` it is renamed from** — measured 2026-08-20 and declined, which is
  the third time ADR-039's reading of this has held. `parsePifLine` builds a
  second shallow object per row that only *references* the same `extra` map, so
  one object per row instead of two looked free. It measured **1.38x** on a
  16,066-row fine PIF tier and **0.88x** — the wrong way — on an 84k-row coarse
  tier, in the same harness, minutes apart. Both readings are noise: at that row
  count the control was 0.94-1.38x, so the harness resolved nothing (see the row
  ceiling in `benches/pafLineParse.bench.ts`). Nothing survives it, and the
  rename is what makes the anchor/mate roles readable at the two call sites that
  consume them.

  **The same session's two accepted changes were both work, not allocation** —
  the tab-offset parse stops scanning and re-wrapping a 1.8kB CIGAR to read
  twelve short fields, and the spread removal stops rebuilding the feature's data
  object dynamically. This entry is the allocation, and it measured nothing,
  again.

- **A `cl:i:` CIGAR-length tag in the PIF format, so the reader can jump the
  `cg:Z:` value instead of scanning it** — measured 2026-08-20 and declined on
  price. The parse has to find the tab that ENDS the CIGAR, which on a fine-tier
  row means touching ~1.8kB it otherwise never reads (the value it keeps is a
  sliced string, O(1)); writing the length beside it in `make-pif` turns that
  scan into arithmetic, and unlike an ordering invariant it degrades safely —
  a file without the tag takes the scan. It works, and it is small: **1.257x
  against a control of 1.000x** on 4,000 hs1-vs-mm39 fine rows.

  That 1.257x is of the tag loop, which is 0.49 µs of a 1.4 µs row. The whole
  change is therefore **~7% of the read path**, and it is 7% that only reaches a
  user who regenerates their PIF files — against 1.6-2.2x that reached every
  existing file the day it landed. A format invariant whose sole consumer is a
  parser fast path is also the kind that rots quietly. Re-open it if the parse
  ever dominates again. Re-measuring it is a fifth arm in `pafLineParse.bench.ts`
  that reads the CIGAR's start and length out of a precomputed array, which
  prices the bound without writing either the tag or the generator half.

- **Fusing the synteny worker's `dedupe` into the decorate pass that follows
  it** — measured 2026-08-20 and declined. The two passes read `id()` twice and
  allocate two intermediate arrays the length of the fetch, so one pass over a
  `Set` looked like free money. It measured **1.00-1.01x** on a 14,599-feature
  whole-genome fetch against a control of 1.02-1.06x, i.e. nothing, and it moves
  a subtle distinction into a loop body: only the query-axis fetch is
  id-deduped, because PIF and all-vs-all give one record's two perspectives
  unrelated ids on purpose and `flippedRibbons` must stay out of that set.
  `plugins/linear-comparative-view/benches/syntenyRpc.bench.ts --base=<ref>` is
  what measured it, and is the way to re-check any candidate here.

  **The generalizable half**: at this scale, removing an allocation is not a
  measurable win. The same session's two accepted changes both removed *work*
  proportional to a product — rows x regions, and a hash per channel per feature
  — and both showed up immediately. The off-screen-mate scratch above is the
  same lesson from the other side: there the allocation removal was measurable
  and still lost, because it moved the cost onto a hotter path.

- **Consolidating the dotplot's cumBp -> px reconstruction behind a transform
  OBJECT, or behind a projector CLOSURE** — measured 2026-08-15 and both
  declined; the scalar-primitive form was taken instead. `(cumBp - viewBp) *
  bpPerPxInv`, with the v axis flipped through the plot height, is written out
  in `drawDotplotInstances`, `pickDotplotFeature` and
  `hoveredFeatureHighlight` (plus the Slang shader, which cannot share), and the
  draw loop runs over 10^5+ segments a frame on the no-GPU path.
  `plugins/dotplot-view/benches/cumBpProjection.bench.ts`, five arms, controls
  0.985-1.031:

  - `projectSegment(g, i, transform, out)` — the shape that dedups the most, all
    four coordinates and the flip in one definition — **1.44-1.47x**.
  - The same helper with every call site normalized to one hidden class, to test
    whether the cost was the three different transform shapes going megamorphic:
    **1.25-1.39x**. So it is mostly the call and the scratch tuple, not the
    polymorphism, and normalizing the shapes would not buy the dedup back.
  - A projector closure built once outside the loop (`px`/`py` over captured
    primitives) — the best-reading option, and by far the worst: **3.4-3.7x**.
    V8 does not inline through it here.
  - `cumBpToPxH(bp, viewBp, inv)` / `cumBpToPxV(bp, viewBp, inv, height)`,
    primitives only — **0.98-1.01x**, indistinguishable from the control.

  Taken: the scalar pair (`DotplotDisplay/dotplotProject.ts`). It dedups the
  formula and makes the v-axis flip an axis-typed name a caller cannot forget,
  which is the failure that matters — draw and pick must agree pixel for pixel or
  the cursor picks the wrong alignment. The price is that the per-axis argument
  pair stays at each call site. The prior reasoning here, "extracting it would
  put a polymorphic call in a hot loop", was right about the object form, wrong
  about the scalar one, and would never have caught the closure.

- **Aliasing the adapter's arrays through `processFeaturesFromArrays` instead of
  copying** — costed 2026-08-15 and declined. It was recommended in the code
  twice, by `packages/wiggle-core/src/transferables.ts` and by
  `plugins/wiggle/src/CLAUDE.md`, both calling the copy "the obvious thing to
  remove next" now that `@gmod/bbi` hands a one-region
  `getFeaturesAsArraysMulti` back as views into a single buffer. It buys one
  `Float32Array(count)` memcpy per source per region, in the worker. It costs:

  - **Main-thread retention 12 → 20 bytes a feature, in the common case.**
    Measured on `cDC.bw`, one region, 14,602 features: bbi returns `starts`,
    `ends` and `scores` as views into ONE `4 + count*12` buffer.
    `collectWiggleTransferables` transfers **buffers, not views**, so aliasing
    `scores` retains all `count*12` where `count*4` is needed — on top of the
    `count*8` interleaved positions, which cannot be aliased either way. Today's
    two fresh arrays are `count*12` total. It is the **one-region** shape that
    regresses, which is the ordinary single-contig view and the one bbi added its
    fused parse for; two or more regions pack a buffer per field, exactly sized,
    so aliasing there is free.
  - **`EMPTY_RAW` becomes a detach landmine.** The module constant in
    `executeRenderMultiWiggleData.ts` is safe only because `count === 0` makes
    `processFeaturesFromArrays` allocate its own arrays, so none of it reaches
    the transfer list. Aliased, its buffers transfer on the first region missing
    a source and are detached for the second — a `DataCloneError` at the
    `postMessage`, nowhere near the cause. `emptySide` beside it is already
    fresh-per-call for this reason.

  **What was given up:** one `count*4` memcpy per source per region, against 67%
  more main-thread memory held for the life of the region, at the 1000-source
  scale the surrounding code is written for. The dedupe in
  `collectWiggleTransferables` stays regardless — it is what makes the aliasing
  that *is* done safe across regions.

- **A main-thread `WeakMap` index for the coverage-band hover readers** — shipped,
  then removed in favour of sorting at the producer, and the measurements are worth
  keeping because the memo looked free at every call site. It answered "which
  entries sit at this position" in log time, keyed on the positions array itself,
  and it cost:

  - **8.00 bytes an entry**, measured against the allocator. That is **2.00x**
    the positions array it indexed, but the figure that decides is the absolute:
    **7.6 MB per 1M-entry array**, retained per region per stacked track,
    invisibly.
  - **An invalidation invariant nothing enforced.** Correct only because a
    refetch replaces the array wholesale; anything mutating one in place got a
    silently stale index.
  - **A silent wrong answer per unkeyed parameter.** `stride` was not in the key,
    so one array read at two strides got whichever index was built first — a
    property of identity-keyed caches, not of that one bug.
  - It was also **slower than not having it**: 1.2-1.4x per hover, from the
    `order[k]` indirection.

  What replaced it: producers emit ascending positions, so readers binary-search
  what they were given and retain nothing. `mismatchPositions` is sorted
  outright; `interbasePositions` within each of its (insertions, softclips,
  hardclips) blocks, since three GPU passes slice on those boundaries. Sorting
  inside the blocks shipped nothing extra, which is why it beat the
  shipped-order-array design parked in TODO.md.

  The one-off moved rather than vanishing: the worker pays 20-21ms on a 1M-event
  fixture where the main thread paid 10ms on the first hover after each fetch,
  larger because it permutes four parallel arrays as well as sorting. Priced in
  `benches/hoverIndex.bench.ts`, which keeps the memo as a transcribed arm so a
  proposal to bring one back has to beat the sorted column rather than the scan.

  **The generalisable rule: ask whether a PRODUCER exists before caching a
  derivation.** Three of these were on paths whose arrays we build ourselves, one
  fetch earlier, off the interaction path. A fourth had no producer and was
  simply wrong — `deletionSpanIndex` was keyed on `gapPositions` while indexing
  an array it allocated itself, so it could never be hit again once that
  temporary was collected, and only looked live because the key outlived the
  call.
- **One reused scratch array for `stackBar`'s per-position sort** — measured
  2026-08-14 and declined as **not resolvable**: 1.17x / 1.01x / 1.09x on 50k
  positions with 2 entries each, and 1.00x / 1.12x / 1.25x on 10k positions with
  8, against controls that themselves swung **0.89-1.11**. The second fixture's
  middle sample is the one to read — scratch 1.12x, control 1.11x, i.e. the whole
  apparent win was the harness.

  The idea is the obvious next step from a comment that invites it: `stackBar`
  heads its loop with `[...colorMap.values()].sort(...)`, one array per position,
  and `computeBisulfiteCoverage` says beside it that spreading the map twice
  "made two lists per position where one is needed" — so the remaining one reads
  like a known cost. It isn't. `scratch.length = 0` plus push, sorted in place,
  emits byte-identical packed output over all five fields and both coverage
  models, and buys nothing.

  The transferable part: a position's colorMap holds 2-8 entries, so the array is
  tiny and V8's young-generation allocation is about as cheap as the refill. What
  scales on this path is proportional to CALLS, not positions —
  `groupByPosition`'s two Map lookups and probability accumulation per call,
  30-40x more work per position than the stack. Same generalisation as the
  `Float32Array` entry below, from the other side: price what the loop count is,
  not what looks allocation-heavy.

  Note that the per-position **object and closure** `heightForPosition` returns
  were NOT tested here and are a different question — that abstraction is what
  keeps the two coverage models from drifting, so it is not a like-for-like swap.
- **A `Float32Array` for the ML probabilities in the modification path** —
  measured 2026-08-14 and declined at **1.008x**, inside its own control (0.994).
  It was the obvious first hypothesis: `getModProbabilities` returns
  `Array.from(ml, v => (+v + 0.5) / 256)`, a boxed `number[]` per read, thousands
  of entries on a nanopore read. Not the cost. The cost, on the same fixture and
  run, was the object per **position** in the running-best array — 4.01x when
  that became a packed `Uint16Array`
  (`plugins/alignments/benches/modExtract.bench.ts`, both arms still in it). So
  price the container that scales with called positions, not the one that scales
  with values.
- **Columnar typed-array output in place of `ModificationEntry[]`** — measured
  2026-08-14 and declined at **3.38x against the 4.01x of leaving it alone**,
  i.e. a regression of about 15% for a substantially larger change. The premise
  looked airtight: nothing survives as an object, since
  `buildModificationArrays` filters the array and immediately flattens it into
  typed arrays, so the objects exist only to carry values between two loops.
  They are also short-lived enough to die in the nursery, while growable typed
  columns pay doubling copies and an intern lookup per push. Same bench, kept as
  an arm. Don't re-propose it without a fixture where the marks outlive the
  fetch.
- **Scanning the MM delta list instead of `split(',')`** — measured 2026-08-14 at
  **1.056x / 1.085x** against controls of 0.995 / 1.006, output identical,
  declined on the size of the number rather than the risk. The allocation is
  real: a nanopore read declares ~950 calls, so the split builds ~950 substrings
  per read — 0.84M over `200x.longread.mod.bam` — purely to run `+` over each and
  throw them away. That is about a twentieth of the pipeline, against a
  hand-rolled integer parser that reads a malformed tag differently from `+`
  (digits only, vs `+`'s whitespace/sign/float/NaN).
  `plugins/alignments/benches/mmParseShape.bench.ts`, both arms kept.

  **The negative is what located the real cost**, which is the generalisation
  worth keeping: `modPhases.bench.ts` puts the whole parse phase at 46% of the
  per-read pipeline, and this says only a tenth of that is the substrings. The
  rest is the delta walk stepping through 43.7 Mbp of read sequence one
  `charCodeAt` at a time. `seqscan.probe.ts` prices `indexOf` jumps over that at
  1.42x — the candidate this measurement redirected to, and it is in TODO.md.
- **Collecting a read's base occurrences to make the reverse MM walk use the
  forward `indexOf`** — the fastest thing measured on that walk, declined for a
  regression its own fixtures could not show. Reverse reads step one base at a
  time because V8 has no fast backward byte search; scanning FORWARD into an
  occurrence list and indexing that from its end gets the fast builtin, and with
  the list in a reused buffer it measured **1.366x / 1.758x** on the reverse
  parse, positions identical (`benches/revCompScan.bench.ts`).

  **It is conditional on something no fixture varies.** The forward arms cross
  the entire read whatever the tag looks like, since the occurrences they need
  are at the far end, while the stepping walk stops once it has placed the last
  call. Both fixtures carry tags that span their reads, so both flatter it. The
  bench's `--cluster` truncates a delta list to make the other shape:

  | coverage | step | hitsArena | |
  | --- | --- | --- | --- |
  | 1.00 | 110.7 ms | 62.9 ms | 1.758x |
  | 0.50 | 67.8 ms | 63.3 ms | 1.070x — break-even |
  | 0.10 | 14.0 ms | 63.1 ms | **0.223x** |

  Gating on it needs the fraction of the read the calls span, which is
  `sum(deltas) + nPositions` against the read's occurrence COUNT — and that count
  is precisely what the scan exists to compute. So every gate is a guess at base
  composition with a magic constant in it, and its wrong answer is 4.5x slower.

  **What would revive it is a cheap exact occurrence count.** BAM stores sequence
  4-bit packed, two bases a byte, so a popcount-style tally over the packed form
  would give it before the string is ever decoded — which is an adapter change,
  not a change here.

  Two smaller negatives from the same bench, both worth not re-deriving:
  reverse-complementing the read to use the forward builtin **loses** (0.79x),
  because building the reversed copy is an O(n) JS pass and the walk it replaces
  is also O(n), so it starts a pass behind; and `TypedArray.indexOf` is a generic
  element search that inherits none of `String.indexOf`'s speed (0.48x). htslib's
  own shape — count, convert to indices from the start, one forward pass —
  allocates nothing and still loses at 0.95x, because counting is itself a scan.
- **`lastIndexOf` for the MM delta walk on reverse reads** — the mirror image of
  a change that shipped, measured 2026-08-14 at **0.786x** against a 0.972x
  control, positions identical. Forward reads find each call with
  `indexOf` and that is 1.560x (`benches/mmDeltaJump.bench.ts`); doing the
  obviously symmetric thing on the reverse half is materially SLOWER than the
  `charCodeAt` stepping it would replace, so reverse still steps.

  Reverse is half the reads, so this is not a rounding error in the decision: the
  both-strands version nets **1.094x** where branching on strand nets **1.263x**.
  Most of the win is thrown away by the half that loses, and a forward-only probe
  cannot see it — the probe that motivated the work reported 1.42x and filtered
  reverse reads out.

  **The generalisable bit is that a native string search is not one primitive.**
  `indexOf` and `lastIndexOf` are different enough in V8 that a mechanism
  argument covering both ("a native scan beats a JS loop") predicts the wrong
  sign for one of them. htslib's third option — parsing the delta list backwards
  from `MMend[]` — is untried and is the thing to measure if reverse is revisited.
- **One sequence pass for all of a read's MM groups, htslib's shape, as a general
  optimization** — built and measured 2026-08-14, output identical, and declined
  everywhere except Fiber-seq-shaped tags. `bam_next_basemod` keeps a countdown
  per canonical base and makes a single pass, so copying it looks obviously right
  and this was first measured at **1.13x** on the ONT fixture. Then the same-base
  merge shipped, `A+a.;C+h?;C+m?` stopped being three sequence walks and became
  two, and remeasuring against the baseline that now ships gives **0.949x — a
  loss**. `plugins/alignments/benches/multiGroupParse.bench.ts`, all arms kept.

  The full sweep, because the crossover is the useful part: 0.917x at one distinct
  group, 0.930x at two synthesized, 0.949x at the ONT fixture's two real ones,
  1.385x at fiberseq's 2.86. **The crossover is between two and three DISTINCT
  groups**, and one pass charges every read base an array index and several
  property loads where the per-group loop is a tight `charCodeAt` do-while — two
  saved passes do not cover that.

  **Two things worth carrying, since the shape is likely to be re-proposed from
  the htslib source:** it must branch on the count of *distinct* groups, because
  counting duplicates puts real ONT output on the losing side; and it must clamp
  at the end of the sequence the way the per-group walk does (`seqLength - 1`
  forward, `0` reverse) for an MM tag that asks for more of a base than the read
  has left. The arm did not, dropping those calls silently, and every row of the
  bench reading "output identical" had only meant no read in those fixtures
  overran.
- **Memoizing `computeVisibleCoverageStats` to make the 500 ms coarse tick
  cheaper** — declined 2026-08-14 by reading what it costs rather than by
  measuring a variant, which is the cheaper order here. The tick was the right
  suspect: it is where the over-budget frames of a six-track pan land, confirmed
  in [INTERACTION_PERF.md](INTERACTION_PERF.md). But the function is a tight
  typed-array loop over the visible bp span — ~19k entries per track at the
  benchmark locus, tens of microseconds — so skipping the work has nothing to
  save, at any track count. What the tick costs is the invalidation it publishes:
  `coverageStats` -> `coverageDomain` -> `coverageDepthDomain` ->
  `renderState`, which is a full canvas repaint per open track, and it happens
  even when every value is unchanged because each step builds a fresh object.
  A **value-equality** memo would stop that chain and is a different change —
  **also declined, and by a count rather than by reasoning.** Six tracks, 360
  frames, 4 coarse ticks: the stats changed at every tick for every display, **0
  of 24 equal**, each display taking exactly its initial value plus one per tick
  (`jb2bench/scripts/render/coarsetick.probe.ts`). The memo has no case to fire
  in, because the tick fires precisely when the coarse window has moved far
  enough to cover different data — and a stationary view does not tick at all,
  MobX caching the computed, so there is no third state where the values repeat.

  Two generalisations, and the second is the one that cost a detour. **Before
  memoizing a getter on a hot tick, ask whether the cost is the computation or
  the invalidation** — they want opposite fixes, one caching the result and the
  other preserving the previous result's identity. And **when a recompute is
  triggered by a change in its own inputs, suspect that its output changes too**:
  the whole suppression idea assumed a tick that fires more often than the data
  moves, and this one fires exactly as often.
- **The Slang-generated `getInstance<Field>` / `setInstance<Field>` accessors in
  per-instance loops** — emitted, adopted across every coverage-band packer and
  Canvas2D draw loop, measured, and reverted to inline indexing against the
  generated per-view offset maps. They are the right shape on paper: each binds
  its field to its own typed-array view, so `position` cannot be written through
  the f32 view and a field whose Slang type changes fails to compile at the call
  site rather than reinterpreting bits — the residual hole the
  `INSTANCE_OFFSET_F32` / `_U32` split left open. They measured **0.43-0.47x on
  the write side and 0.56-0.62x on the read side** against the hoisted-offset
  inline form (`plugins/alignments/benches/instanceAccessors.bench.ts`, controls
  0.98-1.06 across three runs, on 60k and 12k instance fixtures).

  The cost is **the call, not the arithmetic**, which is what makes this a dead
  end rather than a fixable one. The obvious diagnosis is that a per-field
  accessor taking an instance INDEX recomputes `i * STRIDE` once per field where
  the inline form hoists it once per instance — so the fix would be accessors
  taking a hoisted word offset. That variant is the `offset` arm of the same
  bench and measured **0.43x**, i.e. no better than the index-taking one. Don't
  re-propose either shape for a loop that runs per instance.

  **The obvious next move — generate the whole LOOP instead of the field access
  — is only half right, and the half that works already existed.** Three
  generated forms were measured against the same baseline, and what separates
  them is calls-per-record, not how much of the loop is generated:

  - `packInstances` (struct-of-arrays in, **zero** calls per record) — **0.99
    to 1.15x, free.** It is what `packModCovSegmentsForGpu` runs.
  - `InstanceWriter.push` (**one** call per record) — **0.20-0.36x**, i.e.
    worse than the four bare accessors, because the method also reloads four
    `this.` views and tests capacity on every record.
  - a generated `forEachInstance` (**one** callback per record, the read-side
    counterpart to `packInstances`) — **0.14-0.52x**. Written, measured,
    and not emitted.

  So a caller that cannot hand `packInstances` one array per field — because it
  scales on the way in, computes a field, or emits a variable number of records
  — should write the loop over the generated offset maps, NOT reach for a
  generated per-record form. `packCoverageBinsForGpu` (scales and computes),
  `computeSNPCoverage` (one to five records per position) and
  `computeInterbaseCoverage` (one to three records per bucket) are all that
  case, and all are hand-written on purpose. The codegen's own header already says
  this for `packInstances`; the addition is that no other generated shape is an
  escape from it.

  What survives is the emission: `//! layout-out` now writes the full typed
  surface — `INSTANCE_STRIDE_*`, the per-view offset maps, `InstanceArrays`,
  `packInstances` and the accessors — into packages that cannot import the
  plugin owning the `.slang`, and the callers that are not per-record loops use
  it (the two straight-interleave packers; the interbase hit test, which
  resolves one position per mousemove; fixtures, which encode a record through
  `packInstances` rather than by hand). The rule is the loop's iteration count,
  not the module.

  Beware the harness here: a first attempt at the same question dispatched its
  arms through `arms[w](...)`, one shared call site, and reported a
  byte-identical control at **0.31x** — trap #1 in `BENCHMARKING.md`, reproduced
  exactly. The `coverage-bin-cap` fixture (262k instances) is also memory-bound
  enough that its control swings 0.41-1.11 on a contended box; read the 60k and
  12k rows.

- **A generated packer for the sources `packInstances` cannot take — the
  per-field descriptor object, and the `//! pack-group:` directive that would
  have replaced it** — designed, benched against the read pass's own hand loop,
  and declined on the gain rather than on the mechanism
  (`plugins/alignments/benches/instancePackDescriptor.bench.ts`, controls
  0.99-1.04 over 12k / 60k / 200k segments, one process per fixture).

  The entry above says a caller that cannot hand `packInstances` one array per
  field should write its own loop. `packReadSegments` is the largest such caller
  — an instance is a segment, 8 of its 11 fields are per READ and arrive as
  `readYs[segmentReadIndices[j]]`, and `startOff`/`endOff` are lanes of one
  interleaved array. Those are not computations, they are *indexing*, so the
  blanket claim that no generated form can absorb them is **wrong**, and this is
  the correction: a generated form with no call, only hoisted parameters, can.
  What decides it is whether the grouping is STATIC.

  - a declared **group** — one index hoisted once per record and reused by every
    field in the group, exactly as the hand loop hoists `ri` — is **1.00-1.37x**.
    The emitted loop *is* the hand loop.
  - a **per-field index array**, no affine at all, is **0.72x**. This is the
    whole finding: eleven index loads a record where the hand loop does one.
  - per-field index **plus `* scale + bias`** is **0.52x**, and plus a runtime
    `* stride + offset` **0.41x** — both push the index and the value off V8's
    Smi path.
  - a per-field **`index ? src[index[i]] : src[i]`** branch is **0.20x**, the
    worst arm measured, worse than four bare accessors.
  - **materializing** the 8 per-read columns and calling the real
    `packInstances` on them is **0.27x**.

  So the descriptor object in every form is dead, and a declared group is free.
  The directive was still declined: at 60k segments — a typical pileup — the
  generated group form is 0.630ms against 0.632ms, and the entire win is ~1.3ms
  at 200k, on a pack that runs on layout change and recolor, not per frame. The
  prize was never speed. It is that `packInstances` type-checks COMPLETENESS and
  a hand loop does not — add a field to `read.slang` and the hand loop ships it
  as silent zeroes — and a directive buys that for ONE packer while the other
  thirteen, which fail for computed fields and variable record counts, still
  need whatever the generic answer turns out to be. Re-propose the directive
  only alongside that generic answer, not instead of it.

  Two things fell out that are not about codegen at all:

  - **`u32[o + F_U32.startOff]` costs 1.21-1.26x against `u32[o + 0]`** at 200k
    instances. V8 does not fold the property load on the imported offset map, so
    every hand-written packer in the tree pays eleven of them per record.
    Destructuring the offset maps into locals before the loop recovers most of it
    (**1.16-1.19x**) while hardcoding no offset, so nothing can drift. It is
    1.00x at 60k and 12k, i.e. worth ~0.8ms on the deepest pileup only, which is
    why no packer was changed — but it is the cheap half of this whole question
    and wants no new machinery at all.
  - **two partial passes over an 8.8 MB destination beat one pass** doing the
    same stores, **2.36-2.44x**, reproducibly, with a clean control — while the
    same arm is 0.91-0.95x at 60k and 12k, which is the cost walking the buffer
    twice *should* have. The mechanism is not understood; something about the
    single pass's ~10 concurrent read streams degrades past L2. Do not act on it
    without finding the mechanism, and do not delete the arm.

- **Porting `@gmod/bam`'s chunk forecast to the tabix byte gate** — implemented,
  measured across every `.tbi` fixture, and reverted (`@gmod/tabix` ADR 0005).
  `TabixIndexedFile.bytesForRegions` sums every chunk `blocksForRange` offers
  where `@gmod/bam` cuts the list at the linear-index entry past the query, and
  the over-report is real — **3.57x** on `ncbi_human.sorted.gff.gz` at every
  window under a megabase. The port is *safe* (zero queries forecast under what
  they read, which is what killed an earlier attempt) and buys **one row** in
  the whole sweep. It cannot help where the gate actually fires: every NCBI
  RefSeq GFF opens with a `region` feature spanning the whole chromosome at
  offset 0, which pins every linear-index entry on that reference and leaves the
  bound ordering nothing, and a dense VCF already measures 1.00x because the
  query reads all its chunks. The difference from BAM is not the forecast but
  what `blocksForRange` returns: a deep pileup offers 90 chunks and reads 6,
  tabix bins do not.

- **One shared `groupReadsByName`** — measured 2026-08-11 and declined. The arc
  overlay and the bezier connector overlay each bucket reads by QNAME into
  `Map<name, entry[]>` and hand the lists to the same `resolveReadGroup`, so the
  two eight-line loops look like an obvious extraction — the more so because
  this plugin's scars are mostly "one meaning, two paths".

  They differ only in the ENTRY they build: the arc path tags each with its
  region's `refName` (it compares fetched segments against SA-tag/RNEXT ones, so
  same-chromosome-ness is the arc-vs-tick decision) and the bezier path does not
  (both ends are on-screen entries whose refName the overlay resolves at draw
  time). Every way of varying that inside one function is priced per read, and
  this loop runs over every fetched read:

  | entry build                          | 200k reads, 8 regions |
  | ------------------------------------ | --------------------: |
  | object literal (what each does today)|                 1.00x |
  | `{...source, readIdx}` spread        |            1.5 - 1.9x |
  | `makeEntry(source, i)` callback      |            1.1 - 1.45x |

  Interleaved A/B/C, order rotated per round, 25 rounds; absolute medians moved
  a lot between runs (27-63ms for the baseline) so only the ratios are worth
  quoting, and the spread's penalty is the one that reproduces every time.

  The third option — one fixed entry type built by a literal inside the shared
  function — is as fast by construction, but forces `refName` onto the bezier
  path as a placeholder it structurally cannot fill. Paying a per-read property
  write plus a dead field to deduplicate eight lines is not a trade worth making.

  What DID share is the layer underneath: the per-entry accessors (`spanOf`,
  `strandOf`, `flagsOf`, `clipAt`, `isSupplementary`) were duplicated in
  `features/arcs/compute.ts` over the identical arrays, each re-spelling the
  `readPositions` stride — under a comment about keeping that arithmetic in one
  place. Those are exported from `readGroupConnections.ts` now and cost nothing,
  being function calls either way.

- **A compact wire format for the feature-details RPC reply** — measured
  2026-08-11 and declined, and the measurement is worth keeping because every
  instinct points the other way. Clicking a RefSeq BRCA1 hands the main thread
  all 368 transcripts: 15,964 nodes, 8.52MB of JSON, of which the key names
  alone are 2.72MB across **25 distinct** keys, `"NC_000017.11"` appears 15,964
  times, and the whole thing **gzips to 0.21MB — 2%**. It looks like the
  textbook case for interning or a columnar encoding.

  It is not, because `postMessage`'s structured clone is priced by object
  **count**, not by bytes. Main-thread cost of the same payload:

  | transport                             |    ms | bytes  |
  | ------------------------------------- | ----: | ------ |
  | object graph (what ships today)       | 112.4 | —      |
  | JSON string + `JSON.parse`            |  32.2 | 8.52MB |
  | transferable bytes + decode + parse   |  41.0 | 8.52MB |
  | gzip + inflate + parse                |  39.6 | 0.21MB |
  | depth-1 (gene + transcripts, no exons) |   1.8 | 0.18MB |

  **gzip cuts the payload 40x and is slower than a plain JSON string**, because
  inflating and parsing rebuild the same objects either way. Any encoding that
  still materializes 15,964 objects pays the same price, so the encoder is
  wasted work. The only rows that move are the two that change what gets
  materialized.

  The JSON-string row was built (`GetFeatureDetails` returning a string, parsed
  in `deserializeReturn`, main-thread driver exempted) and backed out: the
  profile confirmed the main-thread half — structured-clone deserialize 63ms →
  5.3ms, replaced by a 32ms parse — but the worker must then stringify 8.5MB
  before it can reply, and no end-to-end difference was demonstrable (see
  below). Not worth a wire-format branch on an unproven ~25ms.

- **Wall-clock "click → details panel" as a benchmark** — do not trust it, and
  do not quote a speedup from it without reading this. `fetchCanvasFeatureDetails`
  re-fetches the feature through the adapter, so a **remote read sits inside the
  measured window**; on a hosted hub that is network variance, not app cost. A
  paired A/B across two builds served side by side gave `baseline=1010ms
  fixed=579ms` in one round and `fixed=1338ms baseline=872ms` in the next, and a
  bare before/after on the same box drifted from 871ms to 330ms for the *same*
  build once an unrelated dev server was killed. Substituting main-thread CPU
  from a sampling profile does not rescue it either — `(program)` (GC, JIT,
  native) is ~700-900ms of it and swamps the signal.

  What *is* attributable is per-frame profile time within a single run, which is
  how the numbers in the entry above and in `applyFormatDetails`' fast path were
  obtained. Judge a change on the work it provably stops doing, and keep the
  claim to that.

- **Deferring `SimpleFeature`'s subtree inflation to `children()`** — measured
  2026-08-11 and declined, having looked very promising in isolation: **10.9x**
  on construction alone, and **1.00–1.06x** once the consumer walks the subtree,
  which every renderer does. The construction-only number is the trap — it is
  real and it is not what any caller experiences. Removing the *spread* from
  `inflateSubfeatures` was the win there and shipped separately (2.03x construct,
  1.56x through a render's reads); laziness on top of it buys nothing and would
  move subfeature validation out of the constructor and into the middle of a
  render. One process per arm, generated GENCODE-shaped corpus.
- **Deleting the alignments dup guard (`dedupeById`)** — investigated 2026-08-11
  and kept, though it is catching nothing today. `@gmod/bam`'s `blocksForRange`
  runs `optimizeChunks`, which absorbs a chunk already covered by its neighbour:
  ~4800 index queries over the 20x/200x/1000x fixtures produced **zero**
  overlapping chunk pairs — including where the 5MB merge cap fires, the only
  branch that could push one — and fetching the benchmark window on all six
  produced **zero** duplicate records. The motivation that is genuinely gone is
  older than the code comment's: block rendering fetched adjacent overlapping
  regions, so a feature spanning a boundary arrived twice. It stays because what
  it prevents is silent (a doubled coverage depth, not a crash), because
  `@gmod/bam` hit the same class in its own mate path and still guards it, and
  because keying it on the record's number instead of its id string made it
  nearly free anyway (12.5% → 5.9% of busy worker time).
- **Reading a read's bases out of `NUMERIC_SEQ` instead of decoding `seq`** —
  measured 2026-08-13 in `computeReadBaseCounts` and declined at **parity**
  (6.73x vs 6.74x on `200x.longread.mod`, 3.77x vs 3.68x on `20x.longread.mod`,
  each run one fixture per process against the shipped baseline; three earlier
  all-in-one-process runs agreed). It looks like a clear win and the reasoning
  is worth keeping,
  because it applies to any consumer of BAM's packed SEQ. Once that function
  walks only the modified columns it reads ~28% of a long read's bases, so
  decoding the other 72% into a string reads as pure waste. It is not: the
  decode is a `TextDecoder` pass over a `Uint16Array` of precomputed base pairs
  at ~GB/s, and `charCodeAt` on the flat result is a single load — while the
  nibble path pays a shift, a mask and a second table indirection
  (`CHAR_CODE_FROM_NIBBLE`) at every column. They trade evenly. It would also
  fork the function, since CRAM has no packed SEQ at all — `getReadBases()` is a
  string, and a cached one. Kept as a live arm in
  `plugins/alignments/benches/readBaseCounts.bench.ts` so the negative stays
  reproducible. Same shape as the VCF entry below: the decode is nearly free and
  the byte scan is not faster.
- **Consolidating jest test files** — not the lever. Cold babel transform is a
  ~39.4s serial prefix per worker; app boot is ~1.3s median per suite. Cache
  warmth is the lever.
- **Sequential before/after timing on this box** — produced a bogus 2.2x that an
  interleaved A/B put at zero. See
  [PERF_INSTRUMENTATION.md](PERF_INSTRUMENTATION.md#measuring-on-a-contended-box).
- **Hunting webgl-poc memory leaks** — there are none. Deep-CRAM zoom churn,
  20-navigation churn, remote nav and track open/close all return to a flat
  post-GC floor. The hundreds-of-MB is a transient RPC-worker peak (longread
  CRAM ~997MB → 7MB), root cause `@gmod/bgzf-filehandle`'s grow-only
  module-global wasm memory. Only a rising post-GC floor is a leak.
- **`releaseIfLarge`, re-instantiating the bgzf WASM singleton** — reverted. It
  patched generated glue keyed on internal variable names and had a real
  concurrency bug: bam-js calls `unzip` concurrently, so a mid-flight reset
  nulls `bg.wasm` under a sibling that already passed `await init()`. Real fix
  is a per-call/pooled instance.
- **Fixing blank browser-test captures by waiting harder, by
  `preserveDrawingBuffer`, or by using `toDataURL` bytes as the capture** — all
  three measured, all three declined; the last produced a false 93% drift because
  a differential oracle cannot compare one backend's backing store against
  another's composited layers. Also: **stop running whole-suite A/Bs against
  this**, since failure counts range 0–20 under nominally identical conditions.
  [CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md).
- **Transposing `computeMafCoverage`'s walk, and a SWAR classifier for it** —
  both measured, both worse. The transpose is 0.92x–1.06x; exact-semantics SWAR
  is 0.51x, and the 4.5x a SWAR kernel does show is bought by reclassifying `.`
  and `*` as non-bases, so it is the semantic change priced rather than a win.
  [MAF_WORKER_PIPELINE.md](MAF_WORKER_PIPELINE.md) has the numbers and the
  zero-byte-test trap.
- **Parsing VCF genotypes from raw bytes instead of decoding the line to a
  string** — measured 2026-08-11, and it is backwards: the decode is nearly free
  and the byte scan is *slower*. `TextDecoder` does 28.9 MB of 1000G lines in
  7.4ms (~3.9 GB/s), 6% of what the genotype pass costs, and it produces a flat
  one-byte string that `charCodeAt` reads as fast as `Uint8Array` indexing.
  Worse, `String.prototype.indexOf` beats `Uint8Array.prototype.indexOf` by ~2x
  on the same search, so the byte version gives up the one primitive the scan
  most wants. What the investigation found instead was 2.1x, in two places
  neither of which is the decode. In `@gmod/vcf` (`28300b1`, `781a3e9`): hop
  between samples with `indexOf` rather than a `charCodeAt` loop, and hand the
  scans the *flat line plus offsets* rather than a `line.slice()` — a V8
  `SlicedString` costs an unwrap on every `charCodeAt`, which is all this scan
  does. In `computeSampleInfo` (`f016ae9b97`): accumulate ploidy/phasing by
  column instead of by sample name, and probe the site memo by packed int. A
  whole warm fetch of 1239 records × 3202 samples went **815.9ms → 387.0ms**,
  with the tabix stage unchanged at ~90ms and identical interned codes. Same
  lesson as tabix-js ADR 0003, from the other side.
- **A GPU-side cull for dotplot** — not obviously worth it.
  `drawDotplotInstances` culls on the CPU and notes 87% of a fetch is offscreen,
  but dotplot quads are a few px, so the rasterizer discards them about as
  cheaply as a vertex test would. Synteny's `isCulled` earns its place because
  its quads span the track.
- **Tightening synteny's instance-capacity bound to the emit window** — cannot
  be done. It looks loose (`buildSyntenyGeometry`'s `cigarBudget` comes from the
  full feature width), but `segmentOffScreen` drops a segment only when it is
  off-window on *both* axes, so a segment can survive on axis 1 while far off
  axis 0. The bound really is `widthPx0 + widthPx1`.
- **Closing the hi-C ramp texel-pick difference between GPU and CPU** — up to
  half an entry (sampler texel-center convention vs `round(t * 255)`), which is
  sub-visible on a 256-entry smooth ramp. Closing it adds machinery for no
  effect.
- **Culling hi-C contacts by distance from the diagonal** — measured 2026-08-13
  and declined. The rotated matrix hangs `width/2` px below the diagonal while
  the track is `height` px tall (300 by default, `squashToHeight` off), so at
  1500x300 only 64% of the triangle's AREA is on screen and at 2500x300 only
  42%. Driving that bound through the RPC into `getBlockNumbers` — where a v9
  file's blocks are indexed by depth from the diagonal — looks like a 2-3x cut
  in fetch, decode, transfer and vertex load at once.
  Contacts are not distributed by area. On `extra_test_data/test.hic` (hg19,
  chr1, 100 kb) at 1500x300 the visible band holds **91.3%** of contacts
  (maxDelta 997 bins), at 2500x300 **85.5%** — and **0 of 6** blocks fall
  entirely below the band, so there is no read to skip. 9-15% of the contacts,
  none of the network.
  It also costs two things. The fetch would depend on display height, where
  today a resize only repaints (`computeTriangleYScalar` says so); and a stale
  matrix keeps drawing during the refetch debounce (at the time via
  `renderTransform`'s rescale; since 2026-08-21 at its own genomic position),
  so a culled one shows a flat-bottomed triangle for up to a second.
  **What would change the answer:** a deep v9 map at a fine binsize, where
  blocks are small enough that whole depth levels sit below the band. This file
  is a 5 MB downsample with ~1000-bin blocks, so every block straddles the
  boundary. Re-measure the block accounting, not the contact fraction, before
  re-proposing.
- **A finer fetch quantum for hi-C's buffered static-block fetch** — measured
  2026-08-22 and parked. Since the absolute-coordinates rewrite the display
  fetches `staticBlocks.contentBlocks`, which at a 1588 px canvas is 1.51x the
  visible span (the blocks are 800 CSS px on a grid), so a pan inside them is a
  pure redraw. Contacts grow with span squared and every one of them is an
  instanced quad whose vertices the rasterizer runs whether or not its fragments
  land on screen — at a 50 Mb span on a deep map that is **609,913** contacts
  against the visible span's **318,024** — so the buffer looked like it might
  cost the frame. It does, on one rung, at one zoom.
  **On WebGPU nothing measurable; on WebGL2 ~10 ms at the deepest zoom.** Rao
  2014 HMEC combined (7.6 GB, hg19), 1588x300 canvas, panning a pixel per frame
  inside the loaded blocks, five zooms from 500 kb to whole-chr1: the median
  frame interval never leaves vsync (16.4-16.9 ms) on WebGPU / AMD RDNA-1 in
  either arm at any zoom, while on WebGL2 / Intel UHD 630 the 50 Mb row goes
  **17.3-17.9 ms visible-span to 27.0-27.4 ms buffered** over three runs of
  each, which is 60 fps to ~37 while panning. Every other zoom holds vsync on
  both rungs and both arms.
  The whole-chromosome row is the control: there the static blocks ARE the
  visible span, both arms draw the same 396,234 contacts, and they score the
  same.
  **Parked because the buffer is what bought pan-is-a-redraw**, and what it
  replaced was a refetch on every pan — a network round trip and a spinner
  against 10 ms of vertices. So the lever, if it is ever wanted, is a smaller
  buffer and not a return to refetching: buffered visible spans snapped to a bin
  grid, e.g. expand by a quarter span and snap to 64 bins, which at that zoom is
  ~1.25x rather than 1.51x and on the same measured slope gives back about half
  of the 10 ms.
  **What would change the answer:** pan jank reported on a deep map at an
  arm-scale zoom on a machine where the ladder falls through to WebGL2 — a
  browser without WebGPU, a blocklisted driver, or `?renderer=webgl` — which is
  a rung the app ships and not a hypothetical one. Re-measure before building:
  `products/jbrowse-web/browser-tests/probe-hic-buffered-vertex-cost.ts` carries
  the whole table, the GPU each column was taken on, and the two-line switch the
  visible-span arm needs.
  **The lever also conflicts with a live idea** —
  [ideas/fill-the-whole-display-rectangle-not-just-the-hi-c-triangle.md](../ideas/fill-the-whole-display-rectangle-not-just-the-hi-c-triangle.md)
  wants the buffer *wider*, because the contacts
  measured here as vertex cost are the ones that fill the triangle's empty
  corners. Whichever is built kills the other; decide that before either.
- **Rendering the hi-C matrix as a dense count texture instead of instanced
  quads** — measured 2026-08-13 and declined. The shader is vertex-bound by its
  own account (6 verts per ~1.4 px bin, so a full-width triangle emits several
  times more vertices than fragments), which argues for rasterizing the counts
  into a grid and drawing one quad that inverts the transform per fragment —
  the inverse already exists as `hicScreenToData` and hover already trusts it.
  The matrix is too sparse. Same file and window: 60,109 contacts over
  3,108,771 triangle cells, **1.93% occupancy**, so a dense R32F grid is ~50x
  the memory of the sparse instance list it replaces. The auto binsize argument
  ("bins are ~1.4 px, so texels are screen-sized") holds on the genomic axis and
  not on the depth axis, which is compressed a further ~3.3x — the grid is
  oversampled ~5.5x against the pixels it feeds.
  **What would change the answer:** occupancy, which rises with map depth and
  coarser binsizes. Measure it on the target file first; it is one pass over
  `getContactRecords` output against `nBins*(nBins+1)/2`.
- **Deriving a hi-C normalization vector's value count from its index entry** —
  measured 2026-08-13 and declined. `readNormalizationVector` reads 8 bytes at
  the record start purely to learn `nValues`, which the norm-vector index entry
  already implies: `(idx.size - 4) / 8` matched the read value on every entry of
  the v8 test file. Dropping the read takes that chain from two hops to one.
  It buys no latency. Both of a region pair's read chains are two hops
  (`readChainDepth.test.ts` measures each), and they now run concurrently, so
  the pair waits `max(2, 2)` — shortening one leg to 1 leaves it waiting on the
  blocks. It saves one request, not one round trip, against a `sizeInBytes`
  semantics verified on v8 only (v9 would be `(size - 8) / 4`, unchecked).
- **Workspaces/dockview freeze — two dead ends already paid for.** Width-set
  thrash disproven (that run used canvas2d + empty views and never reproduced
  the freeze, so it bounds `setWidth` only). View-stack windowing disproven as
  the fix: `ClassicViewsContainer` renders the same unwindowed `ViewStack` over
  all of `session.views` and doesn't freeze — don't build virtualization.
  Suspect is MST write amplification.
  [ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md).
- **Vendoring dockview** (copying the source in) —
  [ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md).
  Moot as of 2026-08-12: dockview was **replaced**, not vendored, and is no
  longer a dependency —
  [ADR-068](../architecture-decision-records/adr-068-workspace-layout-is-an-mst-tree.md).
  Left here for the reason it is instructive rather than the reason it was
  filed. ADR-057 declined the rewrite four times on a ~8-9k-line cost estimate
  that measured the whole library rather than the subset a workspace needs; the
  real figure was ~1,940. **A cost nobody has measured is not evidence, however
  many times it gets restated.**
- **Read-time binning for synteny/PIF** —
  [ADR-039](../architecture-decision-records/adr-039-synteny-no-read-time-binning.md).
  `pif.getLines` fetches every line and `parsePifLine` runs per-line before any
  feature exists, so fetch+parse *are* the wait and binning is downstream of
  both. Also: no cap/regionTooLarge gate on synteny — whole-genome overview is
  the point. Lever is a precomputed binned tier in `make-pif`, deferred.
- **Chunking the LD GPU kernel** — proposed, argued at length, reverted as
  unjustified, and three of its supports failed on contact with measurement.
  "TDR at n=8000" could not be reproduced; "integrated graphics would blow
  through the watchdog" is false (Intel UHD 630 runs n=3000 in 1534ms against
  discrete AMD GCN-4's 1469ms — a ~4% gap, not a multiplier); and the display
  needs >=2897 variants *and* WebGPU to have ever been affected. The one device
  loss ever seen was under sustained benchmark load and was never characterised.
  **The 1.8s kernel duration is real and sits in `160158ae26`'s message under
  "Known gap: nothing bounds kernel duration"** — treat that as a standing
  invitation to rebuild the argument from a plausible mechanism, and decline it.
  Don't chunk without a *reproduced* TDR on a named device. Repro
  `jb2bench/scripts/ldlimits.ts`, perf `jb2bench/scripts/ldbench.ts`.
- **The "obvious" wiggle/GPU-fetch simplifications** — bicolor on main thread,
  batched RPC, `inputKey` gate: each already ADR-settled.
- **Network abort as an `AbortSignal` protocol** — cancellation already reaches
  the socket via one stop token, and the two unwirable readers stay unwirable.
  [NETWORK_ABORT.md](NETWORK_ABORT.md).
- **Three "obvious" MAF GPU-encode wins, all measured, all declined.** Landing
  the row-flank byte mask (`ca02f1aba0`, 2.4x on that index) made the rest of
  `buildInstanceBuffer` worth profiling; nothing else in it is worth touching.
  Measured on the UCSC ce11 26-way shape — 48k blocks, median 7bp, 26 rows,
  8.7M cells — interleaved in one process:
  - **Growing the instance writer by doubling instead of seeding it from
    `maxInstances`.** The seed overshoots 4.3x there (140MB reserved for a 32MB
    result), which reads like an obvious waste and is not: the pages are lazily
    mapped, so the reservation costs **0.34ms** and only the written prefix ever
    faults in. Doubling from 1/8 measured **34ms** against the **16ms**
    right-sizing copy `finish()` already pays — strictly worse, and it gives up
    the single-allocation property.
  - **A reused scratch buffer for `buildColumnForGenomicOffset`** (the shape
    `IdentityColumns` uses in `drawRowIdentity.ts`, where it *was* worth it).
    1.7–3.1x on the index build itself, but that build is **under 1%** of the
    encode — so it buys ~3ms and costs callers a shared mutable buffer that a
    future one could retain across blocks and silently read the wrong columns.
  - **Hoisting `packMafCellColorConfig` out of the per-region encode** into a
    display-level computed. It really is per-display state rebuilt per region,
    but it is **0.1–0.3ms per region** — ~0.05% of an encode wave.
- **Restructuring `computeMafCoverage`'s inner loop** — hoisting the `refKnown`
  test out of the per-cell loop (it is constant for the column) and precomputing
  an `isRefRow` byte per block instead of loading `rowSample[i]` on every cell.
  Output-identical, and it *looks* like free wins on the stage that is 69-74% of
  the RPC's CPU on medium and deep regions. Measured against the real
  implementation, both imported, 30 alternating samples: **0.99x / 1.00x / 0.89x
  / 0.90x** across four shapes. The per-block fill loop costs about what the
  cheaper per-cell load saves, and on short blocks it costs more. An earlier
  reading of 1.35-1.43x for the same change was the local-copy artifact
  described below — the variant was local, the baseline imported. `NO_BASE`,
  column-major, and the per-column accumulation are all still carrying their
  own measurements.

  Both stay rejected, but the *reason* they measured flat is now known and is
  worth more than the rejection. Decomposing the per-cell cost
  (`plugins/maf/benches/mafCoverage.bench.ts`, plus one-off kernels) showed the
  loop is not ALU bound and not memory bound: gapless data with nothing to emit
  still costs ~8.5ns/cell, and holding the inner loop at 447 rows while sweeping
  the block footprint from 3KB to 3.5MB leaves ns/cell flat. Peeling the body one
  operation at a time put the largest single item in `alignedBaseUpper`'s
  `col >= len` bound test — a kernel without it is **1.8x** the one with it on
  both a 26x7 and a 447x200 shape. So shaving integer ops off a loop that is
  paying for a bound test is exactly the work that cannot show up. Hoisting that
  test to a per-block `uniformRows` scan (every row of a MAF block spans the same
  alignment columns; a shorter row is the defensive case) landed at 1.13-1.24x on
  the whole function across eight shapes, controls 0.97-1.04x. The lesson
  generalizes past this function: decompose before optimizing, because the rung
  that costs is rarely the rung that looks expensive.
- **Grouping `computeMismatchFrequencies` by contiguous runs instead of the flat
  lane array** — measured 2026-08-16 and declined, after the same change WAS
  taken for `computeSNPCoverage` next door. The mismatches arrive ascending
  (`buildMismatchArrays` sorts), so the entries at one position are contiguous
  and five scratch counters would replace the span pass, the lane array and the
  rare-base Map with nothing. It loses the two rows that matter:
  `benches/coverageFrequencies.bench.ts`, controls 0.94-1.02, run-walk against
  the shipped lane array reads **0.81x on longread-dense** (400k mismatches over
  200k positions) and **0.68x on with-iupac**.

  The reason is run LENGTH and what the function EMITS. Runs of two make the
  run-boundary compare and the second walk of each run cost more than one
  indexed bump, and the lane array is already sized by the mismatches' span
  rather than by the region, so there is no window-sized allocation left to
  delete. `computeSNPCoverage` is the opposite on both counts — its array was
  `windowLength * 5`, and it emits one record per POSITION rather than one per
  mismatch, so the run structure is work it needs anyway. "The same shape helped
  the neighbouring function" is not transferable; what transfers is whether the
  allocation tracks the region and whether the output is per group or per entry.

- **Comparing an imported function against a local copy of it, as a perf A/B.**
  V8 optimizes the two differently, and the gap is large enough to invent a
  result: a control pitting `buildInstanceBuffer` against a byte-identical local
  copy read 0.93x / 1.09x / 0.95x across three shapes. Anything under ~10% in
  that harness is noise. Copy *both* sides locally, alternate which runs first
  (whichever goes first absorbs the other's GC — worth 13% on its own), and
  assert the two outputs are identical before believing the timings. Same
  lesson, different mechanism, as the sequential-timing entry above.

- **Dropping the four parent-walk `WeakMap`s in `core/util/mstUtils.ts`** —
  measured 2026-08-18 and declined, because unlike the three memos above them in
  this file they are actually buying something.
  `packages/core/benches/parentWalkMemo.bench.ts`:

  - The walk costs **13.6-17.6x** the memoized lookup over five runs, and still
    **3.2-3.7x** inside a reaction. `getSession` alone has 465 call sites and is
    reached from render paths.
  - Cost is linear in DEPTH, not in node count: 1 node and 200 nodes cost the
    same per call. Display to session is six `getParent` hops, because every MST
    array in between is a node of its own.
  - **The predicate is not the cost, so a cheaper one is not the alternative.**
    The suspicion was `isSessionModel`'s two `in` checks going through MobX's
    `has` trap; one `in` is ~70ns against a 6.2-7.0us bare walk with no predicate
    at all, ~1% of it. It is MST's own `getParent` and `isAlive`, six hops of
    each. That arm runs last and absorbs the earlier arms' GC — its absolutes
    moved 2x across runs, its ratio did not.

  What separates these from the memos that were removed is the key: a live MST
  node, not a temporary the caller just allocated. `containingDisplayCache` is
  the one with no internal caller left (`getContainingDisplay` is re-exported for
  the plugin ABI and nothing in the repo calls it) — kept anyway, because an
  unused `WeakMap` holds nothing and an external caller gets the same 14x.

- **Hoisting the per-gene `transcriptTypes` / `canonicalTranscriptTags`
  lowercasing out of `layoutSubfeatures` / `scoreIsoforms` into a config-keyed
  `WeakMap`** — measured 2026-08-18 and reverted rather than shipped. 20k genes
  x 4 isoforms went **313-365ms before, 324-349ms after**: noise. The two
  `.toLowerCase()` maps are per gene and look like an obvious hoist, which is why
  this is written down.

- **Avoiding the MAF overlays' forced style flush** — four shapes costed
  2026-08-24 and all four declined: making one overlay pay per frame, moving the
  draw off the passive-effect path, a pre-rasterised glyph atlas drawn with
  `drawImage`, and putting labels on the GPU path. A production profile books
  ~249ms self + 247ms of forced style recalc to `DeletionsOverlay` and ~144ms +
  140ms to `InsertionsOverlay`, which reads like the largest block in a zoom
  gesture. It is not a block anyone can remove.

  **The ceiling is exactly 0ms, and the trace says so.** Style flush is per
  DOCUMENT, not per canvas, and the harness's `(no stack)` recalc bucket — the
  frames' own lifecycle recalcs — is **3.2ms across 27 events while the two MAF
  buckets hold 387ms of a 394ms total**. So MAF's forced flushes are absorbing
  the frame's own recalc entirely: the document is dirty when the overlay effect
  runs, and if MAF does not flush it the frame's lifecycle does, a few hundred
  microseconds later, in a task `main busy` also sums. Every avoidance
  re-attributes the microseconds; none removes work. rAF deferral additionally
  lands labels a frame behind the cells they annotate, which a zoom makes
  obvious.

  Two further traps in the number itself: `topSelf` (v8 samples) and
  `styleRecalc` (Blink trace events) are independent instruments that do not
  subtract from each other, so a recalc run synchronously inside `fillText` is
  plausibly counted in both — the honest attributable total is ~395-780ms, not
  780. And both gates already exist and are correct; a previously recorded
  "insertions fell to 40ms" was taken where rows are too short for a letter, so
  reading it against a sweep that draws labels looks like a regression and is
  not.

  **What the investigation actually found**: MAF writes no per-frame inline
  styles at all. The dirty set is ~150-160 elements, ~90% of it the ~144 tick
  transforms at `ScalebarCoordinateLabels.tsx:81`. **Reopen only** via the
  coordinate ruler — see `ideas/give-the-coordinate-ruler-a-genuinely-fixed-tick-pool.md`,
  whose priority this raises, since the ruler turns out to be charging four
  other subsystems for its dirt.

- **Moving MAF's instance packing to the worker** — costed 2026-08-24 alongside
  wiggle's, which stays alive in `ideas/zoom-perf-followups.md`. MAF's pack is
  126ms and looks like the same opportunity. It is not: its `regionFetchKey` is
  empty by design, so it deliberately does not refetch on zoom and re-encodes on
  the main thread instead, and its pack depends on `binBp` (a power-of-two tier
  off `coarseBpPerPx`) and on the palette. Worker-side packing would turn every
  zoom-tier crossing and every theme flip into a full refetch at ~31ms/region
  (`reference/MAF_WORKER_PIPELINE.md`). It re-encodes precisely because there is
  no RPC to ride along on. **Reopen only if** MAF gains a real
  `regionFetchKey`.

- **Deleting the stop-token sync probe outright** — the published plan, declined
  2026-08-24 in favour of an opt-in `syncProbe` (see
  `ideas/zoom-perf-followups.md`). The plan was: chunk the six await-free worker
  loops that need a synchronous cancellation check, then delete `probeBlobUrl`,
  the blob, `createObjectURL` and the revoke, collecting a measured ~100ms a
  gesture.

  Its premise is false in the one place that matters. There are ~27
  probe-dependent sites, not six, and `clusterMatrix.ts:67` is not a loop at all
  — it is a `checkCancellation` callback invoked from inside a synchronous
  `@gmod/hclust` WASM call, where no `await` can be inserted at any stride. All
  three cluster executors funnel through it. Ship the deletion on that plan and
  Cancel on a large dendrogram does nothing for minutes, silently, and jsdom
  cannot see it because `probeBlobUrl` is inert there. **Reopen only** with the
  cancel measurement that has never existed: an await-free workload cancelled
  mid-flight, probe on vs off.


## Comparative and pangenome

- **Fold the synteny follow's reverse-strand vote into `followWindowsMapping`'s
  block loop** — measured 2026-08-30 and declined. It reads as free: after
  scoping the vote to the contig the row is placed on, `followReverseShare` scans
  exactly the blocks the mapping already visits and accumulates the same
  `overlap` the mapping already computes, so a `reverseOverlap` field on `Target`
  would delete a whole pass. But the two run on **different clocks** — the
  mapping is the frame pass (`followFrameSpan`, once per frame past the picked
  block), the vote is settle-only — so folding moves work from the rare caller
  into the hot one. A/B'd interleaved at 300k blocks over 24 windows, the two
  extra lines cost **0.3% of the mapping loop (0.24ms of 70ms)** while the vote
  costs **3.5ms per settle**: at 60 frames/s against ~2 settles/s that is
  **+15ms/s spent to save 7ms/s**, a net loss of about 2x, and it would put a
  settle-only concern inside the loop the module doc already names as the first
  thing to measure if dragging a whole-genome overview reads as slow. The vote is
  cheap precisely because it accumulates for ONE window where the mapping
  accumulates for all of them. Reopen only if the vote ever has to run per frame.

- **Read the anchor's orientation from the region its window sits on, so a
  `mixed` anchor can still drive the follow's auto-flip** — costed 2026-08-30
  and declined. `orient` declines on `mixed` on either side, which loses the case
  where a reader has reversed one region of the anchor by hand and is now looking
  at another. The obvious fix — `displayedRegions.find` on the window's refName —
  reintroduces the defect it would be fixing: a refName may appear in
  `displayedRegions` more than once with different `reversed` flags, and
  `followAnchorWindows` unions a refName's blocks into ONE window, so `find`
  picks one of several answers arbitrarily — which is exactly how reading
  `coarseDynamicBlocks[0].reversed` came to turn eight regions round to agree
  with the one the window happened to be over. Declining is the honest answer for
  a row that has no single orientation, and it matches what a mixed strand vote
  already gets. Reopen with a window that carries its own region identity rather
  than a refName.

- **Unify `synteny-core`'s viridis onto `@jbrowse/core/util/colorRamp`'s
  256-stop table** — measured 2026-08-30 and declined. `colorRamps.ts:46`
  interpolates ten stops where the core spec keeps all 256, and the ten are
  exact core entries at indices 0, 28, 56, 85, 112, 142, 170, 199, 227, 255 — so
  this really is the "interpolation over a subset" that the core table's own
  comment exists to prevent. It is also invisible: over 10,001 samples of `t`,
  94.3% land on a different colour and the largest single-channel gap is
  **16/255**, at `t ≈ 0.947` in the yellow end. Against that, unifying moves
  every rendered dotplot and synteny identity colour, rewrites the bytes
  `dotplotColors.test.ts:74,77` pins, and needs a golden refresh — a colour move
  no reader can see, for a de-duplication no reader can see either. Reopen if
  the two ever have to agree exactly: a legend drawn from one table beside a
  canvas drawn from the other would show the gap at a seam.

- **Three replacements for the synteny auto-fade's mean block width**, measured
  2026-08-21 and declined in favour of capping each block at 2 px
  ([ADR-083](../architecture-decision-records/adr-083-the-auto-thin-fade-averages-capped-widths.md)).
  The complaint is real: a plain mean follows the widest blocks, and on a
  liftOver chain (`hg38ToHs1.over.pif`, chr1) it read 2.48 px over a view whose
  blocks were 96% sub-pixel, so `'auto'` faded 0% of a whole-chromosome pan at
  every zoom. **The median** — the statistic "predominantly sub-pixel" actually
  names — costs 5 to 11 extra fade flips per chromosome pan at 5–10 Mb views,
  because that population swings 7 → 155 blocks per rollover and the median hops
  between the file's 130 bp mode and its 10 Mb one. **Sub-pixel ribbons per
  pixel** is the steadiest signal measured and the one ADR-033's prose implies,
  but at 0.5/px it never fires on that file at all (peak 0.45/px at 1000 px,
  0.11/px at 4000 px) and it stops fading `peach_grape` on a wide window.
  **Restricting the statistic to the visible window** — measure what is on
  screen — is the worst of the four: 5 to 29 flips per pan against 1, because the
  fetch window's pan buffer is what makes the sample big enough to threshold, and
  roughly 80% of it is off-screen by design. Nor can the latch go: the steadiest
  candidate still flipped three times in one pan on a single threshold.

- **Three designs for softening the synteny thin-fade's transition**, measured
  2026-08-21 and declined in favour of leaving it a snap
  ([ADR-085](../architecture-decision-records/adr-085-the-thin-fade-decision-snaps.md)).
  The complaint is real on paper: the fade is one view-wide boolean over a 0.15
  floor, so the decision changing moves every sub-pixel ribbon by up to 0.85 at
  once. Swept over both shipped files — every chromosome, 24 zooms, panned end to
  end, each flip weighted by what it repaints — **no flip repaints 50 ribbons at
  twice the ink**, and the loudest anywhere is 57 ribbons at 1.67x. **A strength
  ramp** replacing the boolean cannot be built on `cappedMeanWidthPx` at all: a
  capped mean cannot exceed its cap, so the signal tops out below
  `FADE_WIDE_BLOCK_PX` = 2 (1.909 px is the largest either file produces) and the
  strength never reaches 0, leaving every view permanently faded and every golden
  fetch-window dependent. **Easing the uniform over ~200 ms** needs a clock in a
  render path that has none, and `data-display-drawn` would have to treat an
  easing display as unsettled or every screenshot races. **A deadband on the
  ten-block count bar** was built and reverted: it halves the flips that move
  on-screen ink 2x or more (204 → 106), but all 11,247 positions where it
  disagrees with the plain bar are `full` → `faded` at a median of **two visible
  ribbons**, so it buys stability by leaving a near-empty view's hairlines at 15%
  alpha — the thing the count bar exists to prevent.

- **An auto-category for synteny tracks in the LGV track selector** (issue
  [#4327](https://github.com/GMOD/jbrowse-components/issues/4327)) — answered a
  different way, so don't rebuild it as a category. The complaint is real: a
  plain LGV's flat list keeps any track whose `assemblyNames` *contains* the
  view's assembly, so an `hg38` LGV shows both `hg38-vs-mm10` and `mm10-vs-hg38`
  with no signal they are comparative. The issue proposed "query relative" /
  "reference relative" auto-categories and a parked counter-proposal argued for
  one flat `' Synteny'` bucket instead. What shipped is neither: a **per-row
  adornment** naming what the track compares against ("vs mm10"), which the
  filter box also matches on, plus a toggle to take the suffix off the row and
  out of search (`syntenyAdornment.test.tsx`, `syntenyInLgv.test.ts`,
  `HamburgerMenu.tsx`). It answers "is this track relevant to me?" per row,
  where a category answers it per group and then has to name an "other
  assembly" that all-vs-all and 3-way tracks do not have. The direction-based
  split was separately unsound: the adapter convention is `[query, target]` but
  the open-custom-track path writes `[target, query]`, so those tracks would be
  mislabeled.

  **The adornment was then removed too** (2026-08-19), so the issue is open
  again and none of the three shapes above is the answer. Two things killed it.
  The label repeated the track name: real configs name synteny tracks
  `r64_vs_yjm1447_paf`, which made "vs yjm1447" pure duplication on every row —
  the config slot and the "Show track annotations" toggle existed only because
  that was already obvious when it shipped. Worse, in a dotplot or synteny view
  it was *structurally* empty: `filterTracks` lists only tracks covering every
  view assembly, so every row compared the same pair and got the same suffix,
  and subtracting all the view's assemblies left a genuine cross-species track
  with no mate — every row read "vs self". A column that is constant across the
  list carries nothing; one that is constant *and wrong* costs. What went with
  it: `TrackSelector-trackRowAdornment` (declared in core, never published — it
  postdates v4.3.0, so no ABI removal record), `syntenyRowAdornment` in
  synteny-core, `hierarchical.trackAdornments`, the toggle, and the adornment's
  contribution to the row's search text and tooltip. Anything rebuilt here has
  to beat the track name, which usually already says it, and has to say
  something that differs between rows of the same list. The one fact a name
  cannot carry is that an all-vs-all adapter draws against samples that are not
  configured assemblies at all — if that needs saying, say it on the track
  itself, not as a per-row suffix.
- **Reads on the reconstructed derivative allele, the two halves that were not
  built** — closed 2026-08-18, with the middle one shipped (see
  [SV_MULTIHOP.md](SV_MULTIHOP.md) §"Reads on the allele"). Both came out of the
  screenshot review on `cancer_sv/derivative_autogenerated`.

  **Carrying reads onto the reference panel is already possible and off by
  default on purpose.** `refPanelTrackIds` (`LinearDerivativeVsRef.tsx`) copies
  every open track onto that panel except `AlignmentsTrack`, because the panel
  merges every locus the path touches into one window and a pileup there
  refetches reads that are already on screen in the launching view. A user who
  wants it adds the track from the launched view's own selector. The case got
  *weaker* after the middle half shipped: the derivative panel now carries the
  reads in derivative coordinates, so what the reference panel adds is the same
  reads in the frame that does not show whether they agree with the allele. If
  the default is ever revisited, that filter is the line to change.

  **minimap2 in wasm needs bases the feature deliberately does not build.** The
  temporary assembly's `FromConfigSequenceAdapter` carries `seq: ''` — "the path
  is a structure, not a consensus" — so there is nothing to align against.
  Getting bases means either concatenating each segment's reference sequence
  (revcomp for inverted segments, available in-app), which yields a
  *reference-derived* contig rather than the sample's, or building a read
  consensus, which `scripts/sv_multihop.py derive` already does offline with
  samtools and minimap2. wasm in the browser is not the objection —
  `@gmod/bgzf-filehandle` ships a 29 KB inflate wasm on every BAM and VCF read —
  but a minimap2 build is megabytes, so it belongs in an external plugin rather
  than in core for one menu item.
- **A shared home for `useSearchBoxPrefs`** — given one twice, taken back
  twice (`1027a5e075`, 2026-08-12), so the two copies in
  `linear-comparative-view` and `breakpoint-split-view` are the decision, not an
  oversight. `@jbrowse/core/ui` is far too general for a setting only the two
  views that stack several LGVs in one header have, and
  `plugin-linear-genome-view` — where the boxes those prefs govern already live
  — is still a plugin importing another plugin for twenty lines of
  `useLocalStorage`, over a placement that is mostly a synteny concern and does
  not want to be published from anywhere. **The `HeaderSearchBoxRow` import next
  to it is not the counter-argument it looks like**: that the dependency edge is
  already paid is exactly the reasoning that was tried and rejected, twice.

  What the sharing was worth is already kept without it. The two menus had
  drifted on what to CALL the setting — `sideBySide: false` was "Stacked" in one
  and "Vertical" in the other, one state with two names depending on which view
  you opened — and both now say "Stacked", with a comment in each naming the
  other file. That is the failure sharing would have prevented; the storage keys
  (`lcv-`, `bsv-`) were always meant to differ.

- **Projecting the graph onto the reference axis** ("linearizing the
  pangenome") — treat any proposal of this shape as suspect. Repeated source of
  heartache.
- **A minigraph `--call` per-strain track resembling a MAF lane** — can't exist.
  Bubble decomposition caps painted coverage; dense windows come back as one
  bubble.
- **`gfatools bubble` for a pggb coarse tier** — returns nothing. Build the tier
  from the `vg deconstruct` snarl VCF pggb already ships.
- **Reviving the in-repo `plugins/graph` + `packages/graph-core`** — the
  Bandage-style `GraphGenomeView` and `plugins/tube-map-view`, removed by
  `884a126861` and `3b98dbb985`, were restored from `c72b88d177` in 2026-07 and
  ported to a Canvas2D-first render path (typecheck clean, 98 graph tests green,
  never rendered in a browser). Abandoned: graph work now lives in the external
  `jbrowse-plugin-graphgenomeview` bundle, which shipped the subgraph figure the
  revival was for. **The plugin was never the hard part** — the whole cost was
  three months of GPU-stack drift (`@jbrowse/core/gpu/*` → `packages/render-core`
  and the `installGpuDisplay` → `attachRenderingBackend` lifecycle redesign), so
  a revival re-pays that bill and buys a second graph view. Recovery base is
  `c72b88d177`, last commit with everything present and wired; the tip with
  cs-enriched PAF and the multi-anchor demo is `1153a0beb8`. Prior art for the
  data side is in [PANGENOME_GRAPHS.md](PANGENOME_GRAPHS.md#prior-art).
- **"Fixing" `reroot_maf.py`'s first-row anchor or duplicate sample rows** — both
  tried, measured worse, reverted. The 431 overlaps are taffy's re-blocking.
- **Deriving which assembly belongs on which dotplot axis** — there is no
  convention to find, and hunting for one has produced reversed code and docs
  repeatedly. Tracks are meant to be bidirectionally queryable, so both
  orientations are valid and the plot simply transposes. The fixtures actively
  disagree: `test_data/config_dotplot.json`'s default session maps X to
  `names[1]` while the hpylori figure spec maps X to `names[0]`, and
  `detectSwappedAssemblies.ts` exists precisely because either way renders. Call
  `dotplotAxesFromRows` (synteny-core); since `166febd5e6` that is the only
  place the mapping is written down.
- **Re-auditing dotplot `autoDiagonalize`** — audited three ways 2026-07,
  correct as shipped; only unbuilt lever is a best-hit render filter. Multiway
  `autoDiagonalize: true` stays on in tutorial configs.
- **Opening `pangenome_ecoli` with an end-to-end tour, the way
  `pangenome_hprc` opens** — declined 2026-08-16 and the decline stands. The
  page's subject is the linear projections and the graph is the last of its six
  sections, so a tour at the top would open the page on what it covers last; its
  clips sit in the sections that explain them, which is where the HPRC one was
  wrong and these are right.

  **Pasting the track config inside those clips was declined with it, and that
  half was reversed on request 2026-08-21.** Both E. coli graph sections now open
  with a clip that pastes the page's own fence and then launches
  (`pangenome/pggb_subgraph_launch`, `pangenome_cactus/subgraph_launch`), each
  still in its section rather than at the top. The cost the 2026-08-16 note
  predicted was paid rather than dodged, and it is what to weigh before
  reworking these: a pasted lane draws in the default colour, so the clip no
  longer shows the lane and the graph sharing a ramp, and its caption no longer
  says they do. Neither repair works. The ramp is two window constants, which
  `pangenome_hprc` already says belongs on the view and not in a config a reader
  pastes; and the rank jexl HPRC's fence carries does not transfer, because only
  rank 0 has reference coordinates, so a K12 lane under it is one flat colour.
  The correspondence is carried by the page's stills and by
  `pangenome/pggb_layout_switch`, whose session still applies the ramp.

## Data and demos

- **An AlphaFold MSA launch, from the a3m the prediction API advertises as
  `msaUrl`** — removed from protein3d rather than fixed, shipped in 0.9.0 on
  2026-08-25, and it cannot be brought back from any source anyone has found.
  The whole `/files/msa/` path answers **403 at Google's edge**: the response
  carries none of the `x-goog-*`/`UploadServer` headers the bucket puts on its
  own 404s and 200s, so the request is rejected before it reaches storage rather
  than naming a missing object. Every version suffix, AlphaFold's own documented
  example (`AF-G1JSI4-F1-msa_v6.a3m`), a browser UA with a referer and a second
  network all answer the same. There is no second source either — the prediction
  API has no other MSA field, the OpenAPI declares no MSA endpoint, the GCS
  mirror carries model, confidence and PAE only, and the EBI FTP ships
  coordinate tars. It worked in January 2026
  (google-deepmind/alphafold#1111 asks about bulk-downloading MSAs at scale),
  which makes an anti-scraping rule that took individual access with it the
  likeliest reading. **Colin decided not to report it to EBI** (2026-08-18), so
  don't open one. What went with it: `Launch MSA view (AlphaFold a3m)` and
  `Launch 3D structure + MSA view` from both the AlphaFold and Foldseek menus,
  plus `launchMsaView`, `launch3DProteinViewWithMsa`, `getAlphaFoldMsaUrl` and
  the `hasMsaViewPlugin` gate that existed only to offer them. What did **not**
  go, because none of it read the a3m: `connectedMsaViewId` and the whole
  AddHighlightModel hover sync — `findConnectedMsaView` pairs a structure with
  an MSA by a second route, both views hanging off one genome view, which is
  what the JBrowseMSA Gene Explorer and msaview's own ortholog launcher use.
  The silent half was ours and is fixed: react-msaview `9d8af2e`
  (GMOD/JBrowseMSA#111) shows a failed load instead of spinning forever.

- **1KGP ensemble-callset large inversions** — no usable short-read breakpoint
  support. Use the RHD deletion.
- **Human population genetics as tutorial material** — rejected. The
  introgression tutorial (hmmix HGDP archaic segments) was deleted for this;
  population-genomics uses DEST *Drosophila*.
- **A clean COLO829 imprinting demo** — `COLO829_tumor.ht` phases at
  chr20:21.5Mb but has LOH at the classic imprinted DMRs.
- **Rescuing a noisy whole-genome dotplot with `colorBy` or min-length** — pick
  data with real diagonals, draw it black.

## Figures that were attempted and cannot be made

Each of these was a screenshot-review item that got deleted rather than fixed,
because the data does not contain the thing the figure asserted. Don't
re-attempt without genuinely new data.

- **The MAPT 17q21 inversion** — nothing available shows it. 1000G phase 3 SVs
  hold only a 16 kb AC=1 singleton INV in chr17:42–46.5 Mb; gnomAD SV v2.1's
  only INV there is a 53 Mb whole-arm call; HGSVC2 freeze4 *has* the call
  (chr17-45568281-INV-926875) but as one merged row with a single GT column; and
  PanGenie's genotyped release is insdel-only. Structurally: a balanced
  inversion changes no copy number, so arrays are blind to it, and the segdups
  defeat short reads.
- **A PIK3CA somatic-mutation matrix, filtered or not** — the display needs many
  columns and PIK3CA's result is two codons. Unfiltered it is a handful of
  carrier-heavy columns in a frame of empty grey (rejected earlier; the reason
  is recorded on the TP53 spec in `specs/tcga.ts`). The obvious repair, turning
  `minorAlleleFrequencyFilter` on so only recurrent columns remain, makes it
  worse in a second way and was tried at two thresholds: the matrix packs
  columns by feature index across the full width, so dropping columns *widens*
  the survivors. Of 76 columns in the gene, 5 clear 0.01 and 10 clear 0.005,
  giving cells 240–400 px wide and well under a pixel tall — the frame reads as
  a striped row-painting rather than as a matrix, and the subtype bands are not
  legible in either. Measured off the hosted VCF: H1047R 118 tumors, E545K 67,
  E542K 41, N345K 17, H1047L 13.

  PIK3CA's contrast is carried instead by the per-gene recurrence track
  (`mutation_recurrence.py`), where it is 40.6% of HR+/HER2- against 11.2% of
  triple-negative, the mirror of TP53 in the same rows. A hotspot gene wants an
  axis, not a matrix.
- **An LCT swept-haplotype matrix** — the matrix is a uniform field at both
  800 kb and the 160 kb core block, because its MAF≥0.35 variants are common
  across populations, so no swept haplotype resolves as a band. `groupBy` does
  not rescue it; row order was never the problem. The surviving LD figure reads
  causal variant → the block it dragged → where the block ends.
- **An "island of badness" at SMN1 vs a control locus** — three independent
  blockers. gnomAD coverage is continuously under 12x from 69.5 Mb to 71.36 Mb,
  so the nearest edge is 410 kb past SMN1; at a 200 kb window the SMN fetch is
  4.61 Mb and the control 3.93 Mb, both of which trip the byte gate and replace
  the pileup with the banner; and Umap draws as a picket fence past ~30 kb. The
  one finding worth keeping is that **coverage recovers at ENCODE's edge
  (71,359,500), not GIAB's (71,009,585)**.
- **Drawing the pggb 75 bp "spur" as a linear glyph** — it has no K12
  coordinate. `tabix ecoli_pggb.segs.bed.gz 'K12#1#chr:1004500-1004961'` returns
  53 records, every one a K12 interval and none of length 75. A glyph draws what
  the adapter emits, so this needs a bubbles-style record at the detour's
  attachment point, i.e. a build-script change and an upload.
- **A second long-read carrier for the `inverted_duplication` figure** — asked
  more than once, answered no by cohort, not just by this sample's absence.
  `s3://1000g-ont/1KGP_PacBio_WGS` is 140 GM/NA genomes (no HG02768) whose
  integrated callset is assembly-based INS/DEL with **no INV records anywhere on
  chr1**, and all 500 ONT Sniffles v2.6.2 VCFs queried at
  chr1:39,655,000-39,665,000 return zero INV/DUP.

  **A DIFFERENT INVdup in long reads is a live idea, and this is how far it
  got** (review, 2026-08-11: "we might need an example like this that uses long
  reads"). Not rejected — unfinished, and the three cheap answers are all
  already spent, so the next attempt should start from the scan below:

  - The ensemble callset has plenty of INVdup records with an ONT carrier, so
    the cohort is not the obstacle: `bcftools view -r chr1:1-60000000 -S
    <500-ONT-samples> | bcftools query -i 'INFO/CPX_TYPE="INVdup"'` returns
    carriers for HGSV_259, 566, 1196 and more (HG00337 is **1/1** on HGSV_1196,
    chr1:16,081,189-16,082,404). Map the ONT metadata's `GM` ids to `NA` first;
    461 of the 500 are `HG` already.
  - **A call with a carrier is not a call the reads show.** HG00337's own ONT
    over HGSV_1196 is 93 reads, 2 of which carry a strand flip, and neither
    junction repeats. Whatever the Illumina caller saw at 1.2 kb, minimap2 on R9
    does not draw it.
  - **Sniffles DUP∩INV pairs are mostly VNTR.** GM18501's 6 overlapping pairs
    include chr7:100,957,464 (1.6 kb DUP inside a 24 kb INV, support 29/26),
    which is 584 supplementary alignments in 6 kb and 2 strand-flipped reads —
    the MUC3A/MUC12 tandem array, not an event.
  - **A single-sided `STRAND` on a Sniffles INV is the fold-back signature and
    it does find real ones.** GM18501 chr12:86,845,555-86,858,474 (`STRAND=+`,
    support 42) is textbook at the read level: 57 of 121 reads carry a
    forward/reverse/forward chain with both junctions on the same two bases. It
    is still **not this figure**, because depth over the interior is flat
    (~47x against ~47x flanking, spikes only at the two breakpoints) — a
    heterozygous 12.9 kb inversion, which is what `inversion_long_read` already
    shows.
  - **Both routes were then sampled properly and rendered — 20 ONT pileups with
    `arcs:up linkedReads:normal color:strand`, through `jb2export` (the 1000g-ont
    bucket sends no `Access-Control-Allow-Origin`, so a browser capture cannot
    read it at all). Neither route produced an inverted DUPLICATION.** Route A,
    12 INVdup records drawn at random from the 17 in a renderable size band with
    an ONT carrier: every one draws as an insertion column over flat depth, the
    1/1 carrier included. Route B, the 144 single-sided-`STRAND` Sniffles calls
    from 8 genomes: real fold-backs that photograph well, and flat depth.
  - **Don't rank on Sniffles' `COVERAGE` field.** It put the top two Route B
    candidates at 2.1x interior/flank, which is exactly the copy gain being
    hunted; measured off the BAM with `samtools depth` the same two are **1.07x**
    (chr7:70,961,198, 39 of 98 reads strand-flipped) and **1.25x**
    (chr3:162,827,574, 46 of 64). The field was reading against a flank with no
    coverage at all — both loci sit beside a mapping desert, which is also what
    attracts the split alignments that got them ranked. A het duplication is
    1.5x and a hom 2x, so 1.25x is a different event, not a noisy near miss.
  - So the search that would land it is: for every candidate, measure the depth
    ratio **from the BAM**, require both flanks non-zero, and require inverted
    orientation and ratio > 1.4 *together*. Route B's 144 candidates are the
    input and one remote depth profile each is the cost. Until that runs, the
    best long-read pictures available are inversions, and captioning one as an
    inverted duplication would be a claim the picture does not support.

## Tooling, tests and docs

- **A `preserveDrawingBuffer` override to make the webgl blank verdict
  conclusive** — declined 2026-08-25, because the flag that discriminates
  already ships. Half the browser-suite blank captures are unattributable on a
  volatile drawing buffer, and `canvasSelfReport`
  (`products/jbrowse-web/browser-tests/snapshot.ts`) now says so outright and
  names the remedy: re-run that one test with `--real-gpu` (`runner.ts`), which
  a SwiftShader compositing blank does not survive and a render one does. The
  override would be a `getContext` monkey-patch through
  `evaluateOnNewDocument` — a build modification that must not be left on, run
  once, verified against a plain canvas first — to answer what a shipped flag
  answers with none of that. CROSS_BACKEND_GATE.md already refutes it as a
  *fix*; this closes it as a diagnostic too.

- **Sweep the unused exports with knip** — run 2026-08-25 and closed on its own
  terms: the answer is "there is no exports problem here", not "nobody has
  looked". knip 6.32.2, configured per workspace with `src/index.ts` as each
  package's entry and tests and benches excluded, reports **99 unused value
  exports** on a clean tree. Roughly 85 of them fall in four classes that are
  all correct code: `*.generated.ts` shader interfaces, where `pnpm gen:shaders`
  emits a full getter/setter pair per instance field whether or not a pass reads
  it (~60 of the 99); `packages/core/src/ReExports/publicUtil.ts`, whose several
  hundred names are the published `coreUtil` ABI by construction; the vendored
  `color-bits` and `react-colorful` shims; and compile-time assertion types
  (`_AssertSessionModel` and friends), which appearing once is what they are
  for. The residue is about 14 names — `WorkspaceContainer`/`LayoutRenderer`/
  `useLayoutDrag`, `Dotplot1DView`, `getPropertyType`, `panSNSample`,
  `LABEL_FONT_SIZE`, `INSERTION_SERIF_MIN_PX_PER_BP`, two pass-through
  re-exports in `RenderFeatureDataRPC/renderConfig.ts` — none of which is a bug,
  and most of which are published subpaths where removal is an ABI break
  (PLUGIN_ABI_STABILITY.md). **Do not add knip to `pnpm check-docs`**: a gate
  reporting 99 findings on a clean tree teaches everyone to skip it, and
  suppressing the four classes means maintaining an ignore list longer than the
  signal.

- **MobX's `reactionRequiresObservable` as a jest gate**, so an autorun whose
  run read no observable — one nothing will ever re-run — fails the test.
  Measured 2026-08-23 and declined the same day. The pilot looked clean: over
  render-core and BaseLinearDisplay (65 suites) no reaction warned and the only
  hits were three constant getters. The full run said what the pilot could not:
  **1922 failures across 352 suites**, because the flag governs every
  *derivation*, not reactions. The top hits were observer components that
  rendered from props alone (`observerTreeItem` 52k, `observerTrackLabel` 44k)
  and constant computeds (`LinearAlignmentsDisplay.defaultScoreDomain`,
  `LinearGenomeView.minBpPerPx`, every `gateEnabled` default, the session
  `root`, anonymous slot computeds) — all correct code. An exemption list would
  be the tree. Two things stand in for it: the `reactionDependencies` snapshot
  tests state the installers' dependency set per state, and the bug class the
  docs describe (a trigger read dropped under a gate) leaves a *non-empty* set
  anyway, so the flag would not have seen it. Per-reaction
  `autorun(fn, { requiresObservable: true })` is precise but pointless on the
  installers, which read their pure signals unconditionally and cannot hit an
  empty set. **Reopen only** if MobX gains a reaction-scoped flag.

- **A gate for docstring cross-references that no longer resolve** — measured
  2026-08-21 and declined, at a hit rate of about one a month. It has a real
  motivating case: `totalAlignmentBp` pointed at `alignmentCoverageFraction` for
  a month after `4f1c8ebd97` deleted it, and the api-docs generator published the
  dangling name to the website. Every documented member already has an anchor in
  `website/docs/models`, so resolving backticked camelCase names against that set
  looks like a twenty-line checker. It fires **806 times over 342 distinct
  names**, and essentially all of them are correct: a docstring's neighbours are
  `awaitSvgReady`, `computeLoadingTerm`, `installAutoFadeLatch`,
  `syntenyPanBufferPx`, `baseLinearDisplayConfigSchema` — real symbols that are
  simply not model members. The anchor set is the wrong resolution target and the
  right one is every export in the monorepo, which is a ts-morph pass and an
  allowlist for shader constants and file names, for one hit a month. **Reopen
  only** with a resolver that already exists for another reason — the api-docs
  generator gaining a symbol table, say — not as a checker of its own.

- **Extracting the GPU context-loss recovery machine out of `useRenderingBackend`
  into a pure reducer** — proposed 2026-08-18 off this repo's own
  decision/wiring doctrine, then declined the same day when each of its three
  supports failed to measure. The shape invites it: `useRenderingBackend` spreads
  one policy — a 400ms grace window racing `webglcontextrestored`, a
  `1000 × 2^(attempt-1)` backoff, one windowed budget shared across both loss
  families, a latched give-up — over six refs and six effects, with
  `planRegionFetch` and `computeDisplayPhase` sitting next door as precedent.

  The cost argument was a stale comment. Its test file said jest fake timers
  "block React's passive-effect flush, so the recovery effect never fires under
  them", and 12.4s of the file's 13.64s was `await wait(...)`. Advancing inside
  `act` flushes it fine: 1.43s, same assertions. Modern fake timers also fake
  `performance.now()`, so `RecoveryBudget`'s 60s window — offered as the property
  only an extraction could reach — is now an ordinary test in that file.

  **The design argument was backwards, and this is the half to check first on a
  re-proposal**, because it does not surface until the reducer is half written.
  The no-dep effect polling `model.renderError` is not the hook failing to know
  where an error came from: `RenderLifecycleMixin`'s upload and render autoruns
  and `installPerRegionLifecycle` all call `setRenderError` from outside React,
  so the hook has no event for those and can only observe the field. A reducer
  still needs that poll feeding it, and `contextLostRef` is the deliberate
  scoping flag for the errors the hook did not cause.

  What is left is a readability claim, and ARCHITECTURE.md states the split's
  purpose as testability — "the split is what either half can be tested
  against". Both halves are testable in place.

  Sabotage did find two real holes once the file ran in seconds rather than
  fourteen, which is the transferable part: a slow file is where sabotage checks
  stop happening. The cap test's waits (1400/2400/2400) exactly covered backoffs
  of 1000/2000, so deleting `RecoveryBudget`'s give-up branch left it green, and
  the grace window read 0 with all 18 tests passing. Both are pinned now.

- **A static menu TREE, to check that a documented path nests the way the app
  does** — built and measured 2026-08-18, then dropped for a narrower gate.
  `check-menu-labels` verifies every segment of a `**A → B**` path names a label
  the app renders; it cannot see that B sits inside a submenu the path never
  mentions, which is how three of the six view-menu paths in
  `spec-recipe/fields.ts` came to send a reader to the top of a menu for a row
  one level down. The tree was a TypeScript-API pass over `plugins/`,
  `packages/` and `products/`: object literals with a `label`, edges from each
  `subMenu`, calls followed into the helpers that return `MenuItem[]`.
  It reached 207 labels and linked 99 of them to a parent — 48% of the figure
  recipes' 238 paths, with real rows like `Show pileup` and `Show coverage`
  missing outright because their menus are built through item factories
  (`toggleItem('Show coverage', …)`) rather than `label:` properties. Two
  independent faults, either one disqualifying. Coverage: half the corpus is
  skipped and a skipped path looks exactly like a checked one. Soundness: menus
  differ per display, so "is this row served at the top of a menu" has no single
  answer — `Show legend` is top-level on one track and inside `Show...` on
  another, and a doc path saying `Track menu → Show legend` passed the finished
  check. A gate that passes its own sabotage is the failure this repo's checkers
  are written against.
  What it was worth was one run as a lead generator, which is how the noun bug
  behind `check-spec-recipes`' height gate was found: 19 candidate paths, 18 of
  them the tree's own gaps and one a real 31-figure defect. Run that way it needs
  no committed exemption list and makes no promise. Reach for it again by
  writing it, using it and deleting it; do not wire it into `check-docs`.

- **Waiting out a screenshot action's work by watching the app go BUSY, then
  ready** — the obvious shape for the post-interaction gate, measured 2026-08-17
  and replaced by a hold. `[data-app-phase]` publishes `loading` as well as
  `ready`, so "seen busy, then ready" reads like the way to tell work that has
  finished from work that has not begun. Against `search_feature_highlight` the
  app was never observed busy at all: that spec's own `waitForSelector` on the
  highlight overlay already outlasted the redraw, so the bounded busy window ran
  to its 2s cap having watched nothing and the wait cost more than the 1.2s sleep
  it was replacing. `waitForAppSettled` instead requires `ready` to HOLD for a
  second — above the ~600ms `FetchVisibleRegions` debounce, which is the window a
  single read of the selector falls into — so it costs the hold when nothing
  happens and waits out the work when something does.

- **Converting every post-click `{ type: 'delay' }` in the screenshot specs to
  that wait** — two of them are byte-identical swaps and the third proves the
  class is not mechanical. `alignments_soft_clipped_menu` (2.5s sleep, 2.38s wait,
  and the wait *saw* the toggle's refetch in 2 of 23 samples — i.e. the sleep had
  ~120ms of margin over real work) and `alignments/select_arc_display` (3s sleep,
  1.0s wait) both reproduce their committed figure exactly. `search_feature_highlight`
  does not: its sleep covers no app work, and capturing ~200ms earlier moved the
  antialiasing of every glyph on the page, 0.68% of pixels, over the 0.5% diff
  gate and invisible to the eye. A trailing sleep is therefore two different
  things — app work, which the app can be asked about, and the page's own
  rendering, which it cannot — and `website/scripts/probe-app-settled.ts` says
  which one a given spec has before anyone edits it.

- **Letting `generic-filehandle2` resolve through its browser entry, to get
  `fs` out of the desktop renderer** — built both ways 2026-08-16 and declined.
  Deleting the alias in `products/jbrowse-desktop/scripts/config.ts` does clear
  the renderer's one `require("fs/promises")`, and clears the **worker's** too:
  webpack's condition set for `electron-renderer` holds `browser` as well as
  `node`, the package declares `"browser"` first in its `exports`, and one
  `resolve` config serves both graphs — so both get the stub `LocalFile` that
  rejects every read, which is every local file in desktop. `config.target` is
  not the lever either. **The alias stays**; the way out is a dynamic
  `import()` of `LocalFile` behind the capability check, so the renderer's
  graph may contain the node build as long as it never evaluates it. Detail and
  the two-build table in
  [DESKTOP_CONTEXT_ISOLATION.md](DESKTOP_CONTEXT_ISOLATION.md).

- **Lifting the pangenome "linear projections" table out of the pggb tutorial
  into a user guide** — costed 2026-08-17 and declined for want of a second
  consumer. The table is builder-agnostic and names tools the pggb page never
  runs (`halSynteny`, `cactus-pangenome --vcf`), which is what makes it look
  like guide material. But only the Minigraph-Cactus tutorial reads it, and that
  page already opens with its own pggb-vs-Cactus table over the same four
  projections; the HPRC tutorial is graph-first and uses the framing nowhere.
  The three cross-page links out of the Cactus page point at the pggb page's
  **per-projection** sections, which are pggb commands and belong where they
  are. What the case actually was is that the pointer named a page rather than
  the section, so a reader arriving from search landed on top of a long pipeline
  tutorial; it deep-links `#the-linear-projections` now. Revisit if a fourth
  pangenome page wants the concept.

- **A `guides/` directory alongside `reference/`** — tried and collapsed:
  nothing landed cleanly on the line between "how a subsystem works" and "how to
  operate it", so entries drifted between the two and neither directory could be
  scanned. If `reference/` gets hard to scan the fix is better `description:`
  lines, which is what the generated index is read through.

- **A hand-written growable-typed-array writer, generalizing the generated
  `InstanceWriter`** — costed 2026-08-13 and declined for want of a second
  consumer. The generated writer serves the two encoders whose output is one
  interleaved buffer with a shader-reflected stride (`mafInstanceBuffer.ts`,
  `multiRowInstanceBuffer.ts`); no codegen can reach a writer over *parallel*
  arrays, so the question is whether a plain utility is worth it. Exactly one
  site in the tree has that shape — `MismatchWriter` in `computeMafCoverage.ts`,
  doubling `Uint32Array` positions alongside `Uint8Array` bases, with the same
  right-sized-copy `finish`. `IdentityColumns` in `drawRowIdentity.ts` reads like
  a third and is not one: its bound is `refBytes.length`, known before the loop,
  so it sizes once and reuses across blocks rather than doubling — its own
  comment claimed the kinship and has been corrected. One consumer, no shared
  drift hazard, and the generic version would have to be parameterized over both
  element types and the arity.
  **The general form:** "the same shape appears N times" is a claim about the
  growth policy, not about the field list. Check whether the bound is known
  before the loop before counting a site.

- **A comparative-genomics chooser on the tutorials page** — declined by Colin,
  2026-08-09: "overly complicated, they will just have to read the titles." The
  entry argued that the ten synteny and pangenome cards have interchangeable
  ribbon-stack thumbnails, so a reader holding a PAF cannot tell which page is
  theirs, and proposed a decision page routing on what you have. The premise was
  wrong: it reasoned from the thumbnails and skipped the line underneath them.
  Those titles already name the input or the tool — "(pairwise minimap2)",
  "(all-vs-all minimap2)", "Synteny from an ortholog table", "Synteny from
  MCScan anchors", "Pangenome (pggb)" — which is the same key the chooser would
  have routed on.
  **The general form, worth remembering before proposing the next router:** when
  a navigation aid's routing key is already in the labels a reader is looking
  at, the aid adds a surface rather than an answer. Fix the titles that do not
  carry it instead.
- **A shared helper for the RPC method classes' `execute`** — declined three
  times. ~15 classes across 7 plugins repeat `deserializeArguments` → dynamic
  `import()` → `execute({pluginManager, args})`, but the `import()` specifier
  must stay a literal for bundlers and each executor's export name differs, so
  the helper takes a thunk and lands at about the size of the ten lines it
  replaces.
- **Declaring `Reversible` narrowings in `LinearAlignmentsDisplay`** — declined
  2026-08-11. Its filters are edited in a dialog and its menu deliberately offers
  no group clear, so declaring them would mean `clear` closures nothing calls or
  a flag to suppress the row the declaration implies. The shape fits a menu that
  owns the undo; see `packages/core/src/ui/CLAUDE.md`.

- **A rolldown `advancedChunks` group naming a chunk per third-party package**,
  to decouple the examples sites' page budgets from each other — measured and
  reverted. It costs **104 KB a page**: `ultraminimal` 508 -> 645, `index`
  560 -> 664, `synteny` 675 -> 771. The reason is the premise. Chunks are
  page-dependent *because* rolldown cuts them by usage, and that fine cut is
  what keeps a page from downloading a whole package for three components of it;
  pin the boundary by package and every page pays for all of `@mui/material`.
  The coupling is the price of the optimization, not a defect beside it — don't
  retry without a plan for partially-used vendors. See
  [EAGER_BUNDLE.md](EAGER_BUNDLE.md) §"A multi-page site's budgets are coupled".
- **Rewriting an example to import lazily, for bundle size** — backfired.
  `LevelSyntenyCanvas` behind `React.lazy` in `SyntenyRibbons.tsx` is sound on
  its face (it drags 120 KB of compiled synteny shaders) and *raised* every page:
  `synteny` 675 -> 686, `index` 560 -> 565, because the new lazy boundary
  re-partitioned the shared chunks again. It also costs the thing an examples
  site exists for — an example is meant to be pasted and run, so `lazy` belongs
  in one only when the example is *about* deferring something.
- **Golden-snapshot browser tests** — not worth the investment; the one version
  worth building is automated canvas-vs-GPU parity.
- **Prop-change tests via RTL `rerender()`** — it remounts the tree in this jest
  setup, so they pass vacuously.
- **Driver-only teardown for the "worker failed to exit gracefully" warning** —
  does nothing. Needs a full MST destroy in `tests/util.tsx`, and full teardown
  breaks ~13 suites.
- **`matchesSlotShape` delegating to MST `model.is()`** — too permissive; admits
  `NaN` and frozen values.
- **Beta/prerelease tooling** — JBrowse has never cut one.
- **Porting tview into the monorepo** — explored, never landed; `plugins/tview`
  isn't on main.
- **Converting the remaining developer-guide fences to `include:` markers** —
  can't be done without making the guides wrong.
- **A gate on "this `//! js-export` has no importer"** — designed and abandoned.
  Every row it would raise resolves to "leave it" (see the table in
  [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md)), and it would not catch the
  accretion ADR-051 fears anyway: a new marginal export always has a consumer,
  that being why someone added it. It stays a line in a report.
- **A detector for decisions written inline in a `vs_main` body.** The shader
  lift inventory lists *functions*, so a decision with no name is invisible to
  it — and two real exports (`rectSpanPx`, the chevron layout) came from exactly
  there. A detector was still refused: every heuristic available ("this stage
  body contains a pixel snap and a magic constant") is noisy enough that people
  learn to ignore it, which is worse than no mechanism. The control is the habit
  stated in SHADER_JS_CODEGEN.md — when a `vs_main` grows a decision, give it a
  name, and the inventory can then see it. Reopen only with a materially better
  idea than a keyword heuristic.
- **A `groupByMap` beside `groupBy`** — measured, no reason to have it. Grouping
  400k reads by QNAME: object 90.8ms, Map 90.1ms; at 100k the object is *ahead*
  (14.0 vs 17.5ms). The other motive is insertion order, since a plain object
  hoists integer-like keys — but no `groupBy` caller reads its result in order,
  and the places that genuinely need it (tree-sidebar's `ClusterMatrix`,
  wiggle's `groupFeaturesBySource`) already build their own Map and say why.
  `groupBy` itself is on the plugin ABI, so it cannot become a Map: an external
  plugin's `Object.entries` would return `[]` and silently do nothing.
- **A recombination-map lane on the DGRP In(2L)t figure** — the map exists and
  converts cleanly; it is the *reading* that does not hold up. Comeron's 100 kb
  crossover map ships an R6 sheet beside its R5 one
  ([comeron.lab.uiowa.edu](https://comeron.lab.uiowa.edu/recombination-rates)),
  so no liftover is needed. Two things to know before parsing it again: the R5
  and R6 sheets are five side-by-side per-arm blocks, and an xlsx omits empty
  cells, so reading cells in document order rather than by their column
  reference silently drops arms (it read three of five and said nothing). The
  hope was that it would explain why the Fst plateau overruns the inversion
  breakpoints, the way the deCODE map explains the LCT block's edges. It does
  not. On 2L the rate is 2-10 cM/Mb from 1 Mb through ~15 Mb, i.e. high across
  the inversion AND its flanks, and only dies from ~15 Mb to the centromere. The
  Fst plateau runs 0 to ~14 Mb, so a reader lining the two lanes up sees the two
  fall off together and infers that low recombination causes low Fst, which is
  backwards. Around Cyp6g1 the map is 1.1-8.5 cM/Mb over adjacent 100 kb bins
  with no structure to read against the sweep. The lane would need a paragraph
  to stop it being read wrong, which is the test it fails. The parser was
  written, used for this measurement and then deleted rather than left with no
  caller; rewrite it if a fly figure ever wants an arm-scale recombination lane
  for its own sake.
- **An identifier checker for the release drafts** — built, run, and declined as
  overkill for what it buys. It extracted every flag, backticked name and
  CamelCase symbol from `website/release_announcement_drafts/` and failed any
  that appeared nowhere in the source, catching the v5.0.0 draft's
  already-reverted `jbrowse transitive-paf` and its renamed `StatusChip`. Two
  things it needed are the reason not to keep it. Names that are absent ON
  PURPOSE are the whole point of a breaking-changes section, so it needed an
  `<!-- absent-ok: … -->` directive listing eight of them, which a human curates
  and which drifts. And it had to exclude its own file from the corpus, since
  the removed symbols named in its explanatory comments were otherwise evidence
  that those symbols still existed — `CoreRender` passed on that alone. The
  first version also missed `jbrowse transitive-paf`, the case it was written
  for, because a backticked run with a space in it is not one identifier; the
  fix was to tokenize inside backticks. A checker whose heuristics need that
  much repair is a maintenance burden with false confidence attached. The
  remedy in PUBLISHING.md is to have an agent read the draft against the source
  before publishing, which needs no allowlist because it can tell "removed, and
  the draft says so" from "stale" by reading.

- **A step list under each video tutorial, generated from the specs' `say`
  lines** — costed 2026-08-18 and declined as duplication. The argument for it is
  good: `website/CLAUDE.md` says a still is searchable and a clip is not, the
  `say` overlays are authored text that exists only as pixels once filmed, and
  `gen-live-links` already carries spec data into the site, so the list would
  cost one generated field and no re-filming. What kills it is the page above the
  embed. Matched case- and wrap-insensitively, 51 of the 74 `say` lines across
  the 14 videos appear verbatim in the prose of the page that embeds them —
  `tcga_cohort_cnv.md` prints **Clustering → Cluster rows by similarity** from
  the track menu three paragraphs above a clip whose three lines are exactly
  that. The other 23 are mostly the same step in different words (`Right-click
  CDH1`, where the page says to right-click the gene) or narration rather than
  route (`An intronic position maps to no residue`). So the list would restate
  the paragraph a reader has just read, which is the caption rule ("say what the
  picture cannot") applied one element down.
  What would earn it is TIMESTAMPS, turning the list into a way back into the
  clip — and those are the part the specs do not have. `generate-video` stitches
  the film out of per-stretch segments with the `cut` waits removed, so clip time
  is on-camera elapsed time and nothing accumulates it. Recording it per `say` is
  the prerequisite for both this and the caption track `media-store.ts` says is
  next; do that first, and re-cost.

- **A CI guard for screenshot spec ↔ figure staleness** — proposed as
  `ideas/website-screenshot-staleness.md` and closed 2026-08-19, because the
  workflow it was written against no longer exists. The proposal (hash a spec's
  render inputs, record the hash beside the committed PNG, fail CI when they
  drift) was written on 2026-07-08, the same day as the batch it cites —
  `6f0392a387`, 8 specs fixed and 0 PNGs committed, all 8 re-flagged against the
  old images. The weekly sweep landed 2026-08-05 and the S3 figure store
  2026-08-06; nobody re-costed the idea against either, and the move out of
  `OTHER_IDEAS.md` on 2026-08-13 carried the July text unchanged.

  Specs and figures now reconcile the same day. Taking each `specs/*.ts` file's
  last commit against the newest `figures.lock` change among the figures it
  declares: 17 of the 26 files that own figures match to the day, and the widest
  gap is 3 days (`ui.ts`, 2026-08-19 against 2026-08-16). A per-commit check
  would still have fired ~130 times in the week of 2026-08-10, because specs land
  in one- and two-file commits while figures are pushed in batches — and its red
  clears only with a jbrowse-web build and a render against jbrowse.org, which is
  the cost the proposal itself names as the reason regeneration gets skipped.
  That is the trap `.github/workflows/figures.yml` documents for gates built on
  this corpus.

  The bigger reason is that spec edits are not what makes a published figure
  stale. The 2026-08-17 sweep moved 127 of 329 figures past the 0.5% pixel gate
  from one week of app changes, with every author's own regenerations already
  committed. The sweep answers that question weekly, with before/after images;
  the guard would have answered a smaller one.

  **What would earn it**: a review-time pointer, not a gate. `figures.lock`
  tracks one line per figure, so a spec-object hash as a fifth column — written
  by `figures:push`, which runs exactly when someone adopts fresh bytes — would
  make "this figure's spec changed after its bytes were rendered" a check with no
  browser and no network. Build it if the review loop starts re-flagging fixed
  figures again; the sweep, and same-day regeneration, are what keep it from
  happening now.
