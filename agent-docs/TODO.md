---
name: todo
description: Action items to build or fix, the current backlog. Read when picking up work.
---

## Fold the non-LGV fetches onto `FetchMixin`

`LinearSyntenyDisplay` and `DotplotDisplay` hand-roll the fetch state machine in
~490 lines of `afterAttach.ts` plus per-model volatiles: a raw token volatile
each (only `createStopTokenRotation` is shared), their own `loading`/`refetching`
derivations, no `fetchCanceled`/`cancelFetchByUser`, no `reload()`.

The shape: a `SignatureFetchMixin` = `FetchMixin` + `loadedFetchKey` volatile +
overridable `currentFetchKey` + `dataCurrent`, plus an
`installSignatureFetchAutorun` skeleton modeled on `installGlobalFetchAutorun`.
That makes the display-stacks table in
[ARCHITECTURE.md](ARCHITECTURE.md#display-stacks) three rows that all compose
`FetchMixin`, instead of two rows and a footnote.

**Read `@jbrowse/synteny-core`'s `SyntenyFetchStateMixin` first** — both displays
compose it for `fetching` / `loadedFetchKey` / `assembliesSwapped`, so decide
whether this is that mixin growing into `FetchMixin` or a separate move.

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

`createContentHeightProbe` packs straight from the raw worker data and never
clones, so the fit solve's height probes escape the cost. Every *committed*
layout pays it: each settled zoom, each pan into new data, each label or
display-mode toggle.

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

Two cheaper fallbacks if that is too invasive. `flatbushItems` and
`subfeatureInfos` are arrays of objects cloned by spread, so parallel typed
arrays would remove most of the allocation without touching the render contract.
And `rectDensityFade` is worker-allocated but layout-valued, with
`applyLayoutToRegion` writing every element, so `computeLaidOutData` could
allocate it rather than copy it — the catch being that `cloneMutableFields` is
shared with `scaleLaidOutData`, which does not rewrite the array and still needs
the copy, so that split costs a per-caller flag or a second clone helper.

## Stop uploading every rect twice for the continuation pass

`GpuCanvasFeatureRenderer.uploadRegion` packs `numRects` continuation instances
alongside `numRects` rect instances, so the densest tracks pay double the rect
upload and VRAM to draw at most a handful of screen-edge markers. Upload and
VRAM only — `drawRegion` skips the pass on any block touching neither canvas
edge, where every instance would self-cull. The two instance structs are already
byte-identical (`uint2 startEnd; float y; float height; uint color;` plus a
differing 4-byte `ATTR4`: `uint densityFade` on rect, `float strand` on
continuation).

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

Report a diagnostic number first; a regression assertion only after, and well
under the observed threshold (a "12 tracks lose no context" floor) so it doesn't
flake. **The CI number is a floor, not the answer** — headless always falls back
to SwiftShader ([guides/TEST_INFRASTRUCTURE.md](guides/TEST_INFRASTRUCTURE.md)),
whose context cap need not match a real driver's, so the run that characterizes
the limit is headed on a real GPU. Capture both, and say which is which.

## Extra large text SVG mode for pub-ready figures

`BaseExportSvgDialog` exposes font *family* only. Text size is per-element
(explicit `fontSize` attrs plus `SvgCanvas` labels), so a scale factor has to
thread through the same path `fontFamily` takes (`wrapSvgExport` →
`SVGExportRoot`) and every explicit `fontSize` has to become relative, or
labels will overflow the boxes laid out for them.

## Autofit height for the lineargenomeview example-site demo

No view-level auto-height in `products/jbrowse-react-linear-genome-view`; only
per-track `heightMode` grow/fit (demoed in `examples-site` `WithTrackSizing`).

## Grey out the genomic-coordinate option instead of hiding it

`SequenceFeatureDetails/dialogs/SequenceFeatureMenu.tsx` drops the "Coordinates
relative to genome" radio entirely when `showGenomicCoordsOption(mode)` is
false, so the option disappears rather than explaining itself. Render it
disabled, with the reason the label already carries.

## Linearize the pangenome: draw graph variation as alignment-style glyphs

Requested framing: the graph in a *linear* view drawn the way
`plugins/alignments` draws reads, insertions and deletions included, as the
other half of the 2-D Bandage picture rather than a replacement for it.
Correspondence between the two panels is **visual** — matching colors, matching
features — not a shared pixel axis. Do not chase pixel-exact alignment: the
anchored layout's `zoomToFit` pads by 40 px and centers, so its reference axis
runs ~7% narrower than the linear view above it (`pangenome/hprc_mhc_anchored`:
backbone at CSS x 44-955 against the segments track's 7-991), and that is
accepted.

The closest existing per-sample linearized display is
`plugins/maf/src/LinearMafDisplay` (including its `coverageInsertion.ts`).

The data is mostly there, in the two BEDs `scripts/build_rgfa_tabix.sh` emits:

- **Insertions** fall out of `links.bed.gz`. Each L-line is written twice, once
  under each endpoint, and carries *both* endpoints in full with their own
  stable coordinates and ranks, so an off-reference neighbour of a rank-0
  segment is an allele of known length attached at a known reference position.
- **Deletions** are backbone-to-backbone links with a coordinate *gap*
  (`tgtStart > srcEnd`, both ranks 0). Not `s_i -> s_i+2`: a skip can span more
  than one segment, so test the gap, not the id arithmetic.
- The **summary** layer is `MinigraphBubbleAdapter` (`gfatools bubble`, and it
  lives in the external GraphGenomeView plugin bundle, not in this repo), which
  already reports each bubble's reference span with its shortest and longest
  allele, so "how much variation sits here" needs no new file.

Two windows of `links.bed.gz` are measured out in
[reference/PANGENOME_GRAPHS.md](reference/PANGENOME_GRAPHS.md#measured-on-the-hosted-hprc-link-index)
— read it before designing the lane, because four of its findings constrain the
layout: the haplotype label is a discovery attribution rather than carriage,
clean deletions carry no donor at all, one segment id resolves 72 of 78 alleles
without walking the chain, and the volume is tens of records per window.

### The record is a CIGAR

`refConsumed = refEnd - refStart` against `altLen`, so `altLen > refConsumed` is
an insertion, `<` a deletion, and either end falling outside the window is a
clip (6 of 78 in MHC). `scripts/build_rgfa_alleles.sh` emits exactly that record
— offline awk over the two BEDs, 845 alleles on the five-strain E. coli graph
and 208,308 on HPRC in 23 s from the hosted indexes alone, columns named
`firstSeenIn`/`discoveryRank` so the name carries the caveat above.

Build the lane on `drawInsertionMarker` (`@jbrowse/alignments-core`) through an
`OverlayCanvas` pass plus a second `PaintLayer` call on the SVG export, the seam
two other displays already draw indels through — rules and counter-example in
[reference/PANGENOME_GRAPHS.md](reference/PANGENOME_GRAPHS.md#indel-glyphs-shipped).
Not a new display type, not a shader.

### One lane, not rows

Donor rows are not merely sparse, they are misleading,
and the numbers say so: in the MHC window rank 1
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

## Gallery cards hide their live links behind the guide link

`website/src/pages/gallery.astro:117-140` renders the guide link **or** the live
link, never both. 38 of the 39 cards set `guide:`, so all but one show only
"Read the guide", and "Open in JBrowse" is reachable there only by clicking the
image into the lightbox. That is most of why the gallery reads as pointing at
reference pages rather than at a browser you can drive. Showing both is a few
lines and needs no new docs.

While in there, one duplicate-capability pair is still standing, left alone
pending a decision to cut one: `Clustered copy-number heatmap` (1000 Genomes)
against `TCGA-BRCA cohort copy number`. The 1000G card also still points its
`guide:` at `user_guides/multiquantitative_track`, written before
`tutorials/population_cnv` existed, which is now the better destination.

## multi-row

in our tutorial we should link "Track 1: chromosome painting

The painting is a multi-row feature display: one row per strain..." to an actual e.g. config guide or autogen guide or something page currently links to chromhmm


## lai

unclear coloring. some pink shades, what are those

## tutorial 'setup'

Can be in a prerequsites section, doesnt need special sentence e.g. dont need "Setup: nothing to read along. Your own data needs long reads carrying MM/ML tags, which modern basecallers write by default."


## consider rehosting

https://jbrowse.org/jb2-staging/docs/tutorials/population_genomics/

## reduce prose

https://jbrowse.org/jb2-staging/docs/tutorials/linkage_disequilibrium/

the recombination track is not shown also, not sure if we should show maybe could work in lct locus


## consolidate examples

https://jbrowse.org/jb2-staging/docs/config/baseassembly/

unclear why geneticCodes is dropped in some, the super-minimal could be first


## tbi warning


See the Config slots section below for all available configuration fields.
Gotcha

TBI cannot index a chromosome longer than 512 Mb, which some plant genomes exceed. Index those with CSI instead and set both index.location and index.indexType: 'CSI'; the uri shorthand assumes a sibling .tbi.

first  animal genomes can be large too, and (b) we can add a csiUrl:true for shorthand


## autogen docs

related links to bottom.

## config slot table

kind of hard to 'read'. we may want to expand the <details> by default also

## reduce

https://jbrowse.org/jb2-staging/docs/config_guides/assemblies/

## ~~rename~~ ✓

~~CNV tutorials can just say CNV not "Copy number"~~

## generally review and improve

https://jbrowse.org/jb2-staging/docs/tutorials/genomes_synteny/

## reduce

https://jbrowse.org/jb2-staging/docs/tutorials/embed_linear_genome_view/

the initial should be copy-and-pasteable and usable, one track, one assembly. more complete notes could be a <details> at bottom of page

## title

CLI config for Desktop should using JBrowse CLI with JBrowse Desktop
