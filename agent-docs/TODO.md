---
name: todo
description: Action items to build or fix, the current backlog. Read when picking up work.
---

## Fold the non-LGV fetches onto `FetchMixin`

Multi-LGV synteny and dotplot hand-roll the fetch state machine in ~480 lines of
`afterAttach.ts` plus per-model volatiles, sharing only `createStopTokenRotation`
(token mechanics) with each other. Freshness and export readiness are now shared
(`dataCurrent` / `computeSvgReady`), and the progress throttle is shared
(`createStatusThrottle`), so what remains genuinely duplicated is the state
machine: a raw token volatile each, their own `loading`/`refetching` derivations,
no `fetchCanceled`/`cancelFetchByUser`, no `reload()`. (Both now leading-edge
debounce via `leadingEdgeDebounce`, and both diff their shared-backend uploads
through `createKeyedUploadSync`.)

The shape: a `SignatureFetchMixin` = `FetchMixin` + `loadedFetchKey` volatile +
overridable `currentFetchKey` + `dataCurrent`, plus an
`installSignatureFetchAutorun` skeleton modeled on `installGlobalFetchAutorun`.
That makes the display-stacks table in
[ARCHITECTURE.md](ARCHITECTURE.md#display-stacks) three rows that all compose
`FetchMixin`, instead of two rows and a footnote.

**Read `@jbrowse/synteny-core`'s `SyntenyFetchStateMixin` first** — it landed
2026-07 and already shares `fetching` / `loadedFetchKey` / `assembliesSwapped`
between the two displays. Decide whether this is that mixin growing into
`FetchMixin` or a separate move before starting.

## Alignments / canvas

- Group by strand, `plugins/canvas`. Nothing in `plugins/canvas` groups today;
  the vocabulary to copy is `plugins/alignments/src/shared/groupFeatures.ts`
  (`GROUP_BY_DIMENSIONS`, section dividers).
- Sample/library (SM/LB) grouping. `RG` already works via the generic tag
  dimension, but SM/LB live in the header's `@RG` lines, not in the record, so
  this needs an RG→SM/LB map from the adapter.
- Separate quantitative splice-junction track. Sashimi exists only as an overlay
  (`plugins/alignments/src/features/sashimi`).
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`. This is a re-add:
  the old `showTooltips` prop was dropped in the rewrite (see the legacy-props
  comment in `shared/MultiSampleVariantBaseModel.ts`).
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and
  similar displays). `plugins/canvas` already has `hideFeature`
  (`LinearBasicDisplay/baseModel.ts`) to copy.

## Stop rewriting the worker's arrays to lay out features

`cloneMutableFields` (`plugins/canvas/src/LinearBasicDisplay/layout.ts`) is **~78%
of a full layout** — 116ms of 148ms at 4k features, per-phase instrumented, against
8.8ms for the actual packing. It is pure allocation: a fresh `Float32Array` per
geometry channel plus an object spread per `flatbushItems` entry, per
`subfeatureInfos` entry and per `floatingLabelsData` entry, all so
`computeLaidOutData` can add each feature's row offset into the copy in place.

The fit solve's height probes already skip it — `createContentHeightProbe` packs
straight from the raw worker data and never clones, which is what took the
`decimated` rung's solve from 6.1 layouts to 1.4. Every *committed* layout still
pays it: each settled zoom, each pan into new data, each label or display-mode
toggle.

The shape of the fix is to not rewrite the arrays at all — keep the per-feature row
offset in its own `Float32Array` beside the raw result and add it where Y is
consumed. Layout then becomes "compute a row map", i.e. the 8.8ms part.

**Measure the consumers before building it**, because they are the cost, not the
layout. `GpuCanvasFeatureRenderer` already takes per-instance Y so an offset
attribute is cheap there, but `components/hitTesting.ts`,
`components/useOverlayElements.tsx`, `renderSvg.tsx`, `yMorph.ts`
(`interpolateYData`, `captureFeatureTops`) and `scaleLaidOutData` all read absolute
`topPx`/`bottomPx`/`rectYs` today. Count those call sites first and decide whether
they can share one "resolve Y" accessor, or whether enough of them need the offset
folded in that the clone comes straight back — that answer decides whether the
spike is worth it at all.

Cheaper fallback if it is too invasive: `flatbushItems` and `subfeatureInfos` are
arrays of objects cloned by spread, and parallel typed arrays would remove most of
the allocation without touching the render contract.

Smaller and already unblocked: `rectDensityFade` is worker-allocated but
layout-valued, and `applyLayoutToRegion` writes every element, so the
`computeLaidOutData` path could allocate it rather than copy it. Note
`cloneMutableFields` is shared with `scaleLaidOutData`, which does NOT rewrite the
array and so still needs the copy. Splitting that means a per-caller flag or two
clone helpers, which is why it was left alone.

## Stop uploading every rect twice for the continuation pass

`GpuCanvasFeatureRenderer.uploadRegion` packs `numRects` continuation instances
alongside `numRects` rect instances, so the densest tracks pay double the rect
upload and VRAM to draw at most a handful of screen-edge markers. The two instance
structs are already byte-identical (`uint2 startEnd; float y; float height; uint
color;` plus a differing 4-byte `ATTR4`: `uint densityFade` on rect, `float strand`
on continuation).

`makeChevronPass` is the worked precedent for the fix: chevron owns no buffer and
draws off line's via `drawPass(chevron, region, bufferPassId=line)`, wired by
passing line's `bufferStride`/`bufferAttributes`. Unify `ATTR4` (bit-pack strand
into the same word, or widen both structs to one shared stride) and continuation
can do the same off rect.

Not attempted yet because it needs `.slang` edits plus `pnpm gen:shaders`, and a
wrong attribute offset shows up as garbled geometry that no unit test catches.
Verify headed on a real GPU against both backends, since WebGL2 binds attributes
through `vertexAttribPointer`/`vertexAttribIPointer` (int vs float matters) while
WebGPU goes through `vertex.buffers`.

The cheap half is already done: `drawRegion` skips the continuation pass entirely
on a block touching neither canvas edge, where every instance would self-cull.

## `featureItemMap` is an O(N) build serving a handful of point queries

`baseModel.ts`'s `featureItemMap` allocates one entry object per feature AND per
subfeature across every visible region, on every layout change, pan, or zoom. Its
consumers ask very little of it: `useHighlightOverlays` does a handful of `.get()`s
(and genuinely needs `entry.vr` / `entry.data`), while `useFloatingLabels` uses it
only for `?.kind === 'feature'` to decide whether a label is clickable.

That second consumer is removable outright. `emitSubfeatureLabel` always sets
`parentFeatureId` and `processFeatureRecord` never does, so
`clickable === (labelData.parentFeatureId === undefined)` with no map at all.

With it gone the map is built for roughly five lookups, so replace it with an
on-demand region scan or a lazily-populated per-id cache. Worth pairing with the
`cloneMutableFields` item above, since both are per-layout allocation over the same
arrays.

## Measure the WebGL2 context budget in the shape users actually hit

The context ceiling in
[reference/ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md) §"One
WebGL2 context per display canvas" has only ever been measured with a synthetic
24-view harness (since deleted). One view holding 10 to 20 GPU tracks reaches the
same context count and is an ordinary session, and nobody has run it. The number
decides whether track-level mount/release is worth building or whether the
Canvas2D-after-K-losses backstop is enough, so measure before building either.

Home is `browser-tests/suites/gpu-quirks.ts`, beside its existing "recovers from
WebGL context loss" test. Every piece exists: `navigateWithSessionSpec` takes one
LGV with an arbitrary `tracks` array, `test_data/volvox/config.json` carries 124
tracks, `WebGL2Hal` logs `init (live=N/total)` and `context LOST` under
`?webgl2-debug=1`, and `runner.ts` has a `page.on('console')` hook to collect
them. Walk N up, record where an **unforced** `context LOST` first appears and
whether recovery settles or cascades.

Report a diagnostic number first. Only then consider a regression assertion, well
under the observed threshold (a "12 tracks lose no context" floor) so it doesn't
flake.

**The number from CI is a floor, not the answer.** Headless always falls back to
SwiftShader ([guides/TEST_INFRASTRUCTURE.md](guides/TEST_INFRASTRUCTURE.md)), whose
context cap need not match a real driver's, so the run that characterizes the
limit is headed on a real GPU. Worth capturing both and noting which is which.

## Extra large text SVG mode for pub-ready figures

`BaseExportSvgDialog` exposes font *family* only. Text size is per-element
(explicit `fontSize` attrs plus `SvgCanvas` labels), so a scale factor has to
thread through the same path `fontFamily` takes (`wrapSvgExport` →
`SVGExportRoot`) and every explicit `fontSize` has to become relative, or
labels will overflow the boxes laid out for them.

## Autofit height for the lineargenomeview example-site demo

No view-level auto-height in `products/jbrowse-react-linear-genome-view`; only
per-track `heightMode` grow/fit (demoed in `examples-site` `WithTrackSizing`).

## Genomic w/ full introns is still rendering cds in copy sequence dialog

grey out the genomic coord option instead of hide
tooltip on verticalguide

## Linearize the pangenome: draw graph variation as alignment-style glyphs

Requested framing: the graph in a *linear* view drawn the way
`plugins/alignments` draws reads, insertions and deletions included, rather than
only as the 2-D Bandage picture. The Bandage view is the preferred picture of
the graph itself; this is the other half, and correspondence between the two
panels is meant to be **visual** (matching colors, matching features) rather
than a shared pixel axis. Do not chase pixel-exact alignment: the anchored
layout's `zoomToFit` pads by 40 px and centers, so its reference axis runs ~7%
narrower than the linear view above it (measured on
`pangenome/hprc_mhc_anchored`: backbone at CSS x 44-955 against the segments
track's 7-991), and that is accepted.

The glyph vocabulary already exists: `insertion.slang`, `gap.slang` and
`clip.slang` under
`plugins/alignments/src/LinearAlignmentsDisplay/shaders/slang/`. The closest
existing per-sample linearized display is `plugins/maf/src/LinearMafDisplay`
(including its `coverageInsertion.ts`).

The data is mostly there today, in the two BEDs `scripts/build_rgfa_tabix.sh`
emits:

- **Insertions** fall out of `links.bed.gz`. Each L-line is written twice, once
  under each endpoint, and carries *both* endpoints in full with their own
  stable coordinates and ranks, so an off-reference neighbour of a rank-0
  segment is an allele of known length attached at a known reference position.
- **Deletions** are backbone-to-backbone links with a coordinate *gap*
  (`tgtStart > srcEnd`, both ranks 0). Not `s_i -> s_i+2`: a skip can span more
  than one segment, so test the gap, not the id arithmetic.
- The **summary** layer is `MinigraphBubbleAdapter` (`gfatools bubble`), which
  already reports each bubble's reference span with its shortest and longest
  allele, so "how much variation sits here" needs no new file.

### Measured against the hosted HPRC indexes

`tabix` on `hprc-v2.0-mc-grch38.links.bed.gz`, two windows from the tutorial's
own loci: C4 (`GRCh38#0#chr6:31,980,000-32,050,000`, 70 kb) and MHC class II
(`32,450,000-32,650,000`, 200 kb). Four things the note above got wrong.

**Haplotype identity is already there.** `SR` is build order, but `SN` on a
rank>0 segment is the PanSN contig of the haplotype that introduced it
(`HG01433.2#2#CM086511.1`), and rank maps 1:1 to donor (MHC window: 16 ranks, 16
donors, no rank shared). links.bed.gz labels every off-reference allele with a
haplotype, so the W-line projection is not needed for haplotype-labelled rows.
The catch that decides the layout: minigraph collapses, so the label is the
*first* haplotype to contribute the allele, never everyone carrying it. 464
haplotypes in the graph, 15 donors in the MHC window, about one allele per row.
Rows keyed on it are a discovery attribution, not a pileup, and must not be
labelled as one.

**Clean deletions are anonymous.** A backbone-to-backbone skip has GRCh38 on
both ends, so no `SN`, so no donor. A deletion only gets one when it carries
novel sequence, i.e. a small alt segment bridging a large reference skip
(`s462766`, 1 bp, HG01952.1, bridges 31,984,683 to 31,991,051, a 6.3 kb
deletion). MHC window: 8 anonymous deletions against 78 attributed alleles. So a
per-haplotype row layout can place insertions but not deletions, which is the
argument for one summary lane over 464 rows.

**Chain walking is mostly unnecessary.** An alternate path can be several
segments and its interior links are indexed under the *donor* contig, so a
reference query never returns them. But 72 of 78 alt segments in the MHC window
appear in both an off-backbone and an on-backbone link, so one segment id gives
the whole allele: `refStart` = entry's srcEnd, `refEnd` = exit's tgtStart,
`altLen` = that segment's own length. The remaining chains resolve without the
interior too, because entry and exit share `SN` and donor coordinates are
contiguous across the allele (`s526659` 31,891,267-31,923,687 then `s526660`
31,923,687-31,924,005, so altLen 32,738). Pair those by `SN` *then* donor offset;
`SN` alone is ambiguous, HG01433.2 contributes 41 entries in that one window.

**Volume is trivial.** MHC 200 kb: 320 unique links, of which 155 are
backbone-adjacent, 8 deletions (mean 605 bp), 78 off the backbone, 79 back onto
it, 0 alt-to-alt. C4 70 kb: 36 unique links, 1 deletion, 10 out, 11 back. Tens of
records per window, no density gate needed. That 0 is a property of the
reference-keyed index, not of the graph: the interior links of a multi-segment
allele are indexed under the donor contig, so a GRCh38 query never returns them.

### The VCF is not symbolic, so allele length is not what the graph adds

`wave.vcf.gz` at `chr6:32,010,000-32,020,000`: 126 records, **zero** symbolic
ALTs, explicit ALT strings up to 65,481 bp, genotypes per haplotype. So
`LinearMultiSampleVariantDisplay` already gives exact allele lengths with real
carriage across 464 phased haplotypes, plus the SNPs minigraph collapsed. The
linearized graph does not beat it on length or on carriage. What it adds:
segment-level correspondence with the Bandage panel (same segment ids, same rank
colors), the chaining and nesting of an alternate path, and working on any
minigraph rGFA with no `deconstruct` step, which is the E. coli tutorial's graph
and anyone's own minigraph run.

### Build order

The derived record is a CIGAR in all but name: `refConsumed = refEnd - refStart`
against `altLen`, so `altLen > refConsumed` is an insertion, `<` a deletion, and
either end falling outside the window is a clip (6 of 78 in MHC).

- **The rGFA-only allele inventory shipped** as `scripts/build_rgfa_alleles.sh`,
  offline awk over the two BEDs. 845 alleles on the five-strain E. coli graph,
  208,308 on HPRC in 23 s from the hosted indexes alone. It reproduces 747 of
  `minigraph --call`'s 842 alleles with the identical delta in the same bubble;
  the 95 residuals are compound routes at 69 nested bubbles, every one at a
  bubble the file does describe. Still **one lane, not haplotype rows** (the
  columns are named `firstSeenIn`/`discoveryRank` so the name carries that), but
  the lane packs into rows via the alignments display, because each allele
  carries a CIGAR — see the handoff.
- **`minigraph --call` superseded the rest of this list, and shipped.** See
  below.

### It is a display gap, not a data gap

The section above concludes the VCF already beats the graph on length and
carriage, which is true of the *data* and misses where the request actually
bites. `computeVariantCells.ts:50` draws every insertion as a full-height
barcode line at its locus, identical to a SNP, and records that a distinct glyph
was tried and reverted because it collapsed to an unreadable locus-centered dot
when zoomed out. So a 65,481 bp ALT in `wave.vcf.gz` currently draws exactly as
wide as a SNP. `getAlleleLength` (`shared/alleleLength.ts`) already exists and
its own comment states the problem. The picture the request wants does not exist
for *either* source, and the display that has the 464 rows is in-repo, beside
the shaders it wants to borrow. Three moves, best value first.

**A. Length-aware glyph on `LinearMultiSampleVariantDisplay`. DONE — see
"Shipped" below.** Data already hosted, already in the HPRC
tutorial, rows already 464 phased haplotypes, `AF`/`AC`/`AN` on 125 of 126
records in the C4 window so frequency needs no computing. The earlier attempt
failed because the glyph was drawn *at* the locus with no extent; give it the
extent `getAlleleLength` already computes and fall back to the barcode line only
when that is sub-pixel. Deletions already consume reference, so they need only a
distinct treatment, not a new geometry.

The route is now proven rather than speculative: `LinearMultiRowFeatureDisplay`
got exactly this treatment (`lengthField` + `drawMultiRowIndelGlyphs`, see
"Shipped" below), so the pattern to copy is an `OverlayCanvas` pass over
whichever backend drew the cells, calling `drawInsertionMarker` from
`@jbrowse/alignments-core`. That sidesteps `variant.slang` entirely, which is
what made the original estimate look expensive. Note the multi-row lesson too:
draw the bar only where it is *wider* than the cell, because a same-colored bar
inside a wide cell is invisible overdraw and the label is what actually carries
the magnitude.

**B. `minigraph --call` is the third BED, and it is a documented one-liner.**
Not W-lines out of the 63 GB GFA or the 5.4 GB GBZ:
`minigraph -cxasm --call graph.gfa sample.fa` emits one line per `gfatools
bubble` line, carrying the path through the bubble, its length in the graph, the
strand, and the sample contig with its span; `mgutils.js merge` joins the
per-sample calls into one file. We already host `bubbles.bed.gz` built by
`gfatools bubble` on the same graph, so the calls join to it line for line. For
E. coli (5 strains, our own `build_ecoli_pangenome_graph.sh`) that is seconds of
compute and it is the true per-haplotype pileup with real carriage, from the
graph alone. For HPRC it needs the 464 haplotype assemblies re-mapped, so HPRC
stays on the VCF. This supersedes the W-line third-BED work item entirely.

**C. The rGFA lane is one lane, not rows.** Donor rows are not merely sparse,
they are misleading, and the numbers say so: in the MHC window rank 1
(HG01433.2#2) accounts for 41 of 78 alleles, rank 2 is that sample's sibling
haplotype with **0**, and ranks 230 and 345 have 1 each. Monotone decay in build
order, because the earliest haplotype absorbs every allele later ones share. A
donor-row plot reads "HG01433.2 is the most structurally variable haplotype
here", which is an artifact of being added first. So: one lane, backbone as the
body, insertion ticks at the attachment points sized by allele length, gaps at
the skips, clip at the window edges. It works on any rGFA with no VCF and no
re-mapping, and it is the panel that shares segment ids and rank colors with the
Bandage view.

Rank is also a weak rarity bound (rank r proves absence from haplotypes 1..r-1,
nothing more), worth a color ramp only where no `AF` exists, i.e. a user's own
graph rather than HPRC.

### Shipped (B, plus the glyph vocabulary on the multi-row display)

- `scripts/build_minigraph_paths.sh` runs `minigraph -cxasm --call` per assembly
  and projects the calls into one tabix-indexed BED, a row per bubble per sample,
  with the class, the signed delta, both lengths, and the traversed segment ids.
  Its header is the **contract**, so a graph carrying W/P lines or an rGFA with no
  assemblies can fill the same schema from a different producer; the script header
  lists those. Wired into `build_ecoli_pangenome_graph.sh`, and hosted at
  `jbrowse.org/demos/ecoli_pangenome/ecoli_minigraph_paths.bed.gz`. Five-strain
  E. coli: 601 bubbles, 3,006 rows, 37 KB. **K12 comes out `ref` at all 601
  bubbles, which is the pipeline's own end-to-end check** — if the reference row
  ever shows an indel, suspect the join before the biology.
- Two traps that pipeline hides. A bare `.` in the call's last field is *missing
  data*, but read as colon-separated it yields pathLen 0 and scores as a deletion
  of the whole reference span. And `*` is an *empty path*, which is a deletion
  only where the bubble has reference span: 72 of the 601 bubbles have none (pure
  insertion sites) and there `*` is the reference allele. Classifying on `delta`
  handles the second without a special case; the first needs the explicit check.
- `LinearMultiRowFeatureDisplay` gained a `lengthField` slot plus
  `rendering/drawMultiRowIndelGlyphs.ts`, drawn by an `OverlayCanvas` over
  whichever backend painted the blocks and by a second `PaintLayer` call on the
  SVG export. No new display type, no new adapter, no shader — the reasons are in
  the "display gap" section above, and the git history is the argument:
  `884a126861` deleted `MultiLGVSyntenyDisplay`, ~4,000 lines over 25 files with
  three bespoke `.slang` shaders.
- Tutorial section + figure: `pangenome_ecoli.md` "Which strain takes which
  path", `pangenome/rgfa_strain_paths`.
- Then A, the same treatment on the **regular (non-matrix)**
  `LinearMultiSampleVariantDisplay`, which is the one that draws every cell at its
  true genomic position and width and so is the display to reach for on SV
  figures. `showInsertionGlyphs` (shared schema, default on) +
  `components/drawVariantInsertionGlyphs.ts`, again an `OverlayCanvas` plus a
  second call on the SVG export, no touch to `variant.slang`. Two rules the
  multi-row pass taught: widen only where the bar exceeds the cell (a
  same-colored bar inside a wide cell is invisible overdraw), and keep the
  **cell's genotype color** rather than the alignments purple, since the color is
  what says which allele the haplotype carries. Plus one this pass needed on its
  own: only cells whose genotype actually carries the allele widen
  (`cellCarriesAlt`), or the marker claims every reference haplotype has the
  sequence.
- The slot lives in the **shared** schema because the model factory is typed to
  `SharedVariantConfigModel`, so a slot declared on the subclass is not visible to
  `getConf`. The matrix display therefore inherits it and ignores it (it lays
  columns out by feature index, so there is no genomic width to correct); the slot
  doc says so.
- Only one committed figure moved: `hprc2/mhc_clustered` (1.09%), where the 220
  structural alleles now read at up to 5px instead of the 2px SNP floor. Every
  other spec touching this display came back 0.000% — `multisv` uses symbolic
  ALTs, which carry no measurable length, and the matrix specs ignore the slot.
