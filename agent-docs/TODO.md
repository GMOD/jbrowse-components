---
name: todo
description: The backlog — action items to build or fix, grouped by how ready each one is: small and self-contained, designed and ready to build, or blocked on a measurement that has to come first. Read when picking up work.
---

# Backlog

Grouped by **what you have to do first**, because that is the thing most of these
entries actually disagree on. A third of them are ordinary build work; another
third carry a design that survived a rejected alternative and needs following
rather than re-deriving; most of the rest open with an instruction to go measure
something, because the premise or the cost attribution is not established and
building first would be guessing. One is blocked on a decision that is not the
implementer's to make.

Exploratory concepts that are *not* committed work live in
[OTHER_IDEAS.md](OTHER_IDEAS.md).

| Item | Area | First move |
| --- | --- | --- |
| [Grey out the genomic-coordinate option](#grey-out-the-genomic-coordinate-option-instead-of-hiding-it) | feature details | render the radio disabled |
| [Autofit height for the LGV demo](#autofit-height-for-the-lineargenomeview-example-site-demo) | embedded | no view-level auto-height exists yet |
| [Extra large text SVG mode](#extra-large-text-svg-mode-for-pub-ready-figures) | SVG export | thread a scale the way `fontFamily` threads |
| [Alignments / canvas odds and ends](#alignments--canvas) | alignments, canvas | five independent small items |
| [Report a callout that draws off-frame](#report-a-callout-that-draws-off-frame) | figures | the overlay already reports the unresolvable case |
| [`partitionField` throws on `bigRmskBed`](#partitionfield-jexl-throws-through-its-own-guard-on-bigrmskbed) | canvas | the per-feature catch is there and not holding |
| [Render the converted callout specs](#render-the-twenty-specs-whose-callouts-were-converted-to-anchors) | figures | sweep them; five move deliberately |
| [Comparative cancel and retry](#give-the-comparative-displays-a-cancel-and-a-retry) | synteny, dotplot | read ADR-054 first; retry is a button, never automatic |
| [Stop uploading every rect twice](#stop-uploading-every-rect-twice-for-the-continuation-pass) | GPU canvas | unify `ATTR4`, then verify headed on both backends |
| [Linearize the pangenome](#linearize-the-pangenome-draw-graph-variation-as-alignment-style-glyphs) | pangenome | read PANGENOME_GRAPHS.md — four findings constrain the layout |
| [Reads on the derivative allele](#reads-on-the-reconstructed-derivative-allele) | cancer SV | two open halves; the middle one is already built |
| [PanSN prefixes in the add-track form](#offer-a-files-pansn-prefixes-in-the-all-vs-all-add-track-form) | comparative | the error half shipped; this is the discovery half |
| [Synteny clicked outline in tiled mode](#the-synteny-clicked-outline-strokes-every-match-tile-in-transparent-indel-mode) | synteny | get the visual call — hull silhouette or per-tile |
| [Cut WebGL2 contexts per display](#cut-webgl2-contexts-per-display) | GPU, limits | build — ceiling measured at 16, one ordinary view crosses it |
| [MAF fetch cost on long blocks](#maf-fetch-cost-on-long-blocks) | MAF | run the one-line block-size check; premise unconfirmed |
| [Alignments main-thread repack](#alignments-still-repacks-every-row-instanced-pass-on-the-main-thread) | alignments, GPU | profile the pack/upload/clone split first |
| [Stop rewriting the worker's arrays](#stop-rewriting-the-workers-arrays-to-lay-out-features) | canvas | count the consumers — they decide if it is worth it |
| [`featureItemMap` O(N) build](#featureitemmap-is-an-on-build-serving-a-handful-of-point-queries) | canvas | pairs with the entry above |
| [What is left of the row-display family](#what-is-left-of-the-row-display-family-and-the-one-part-not-worth-sharing) | maf, variants, canvas, wiggle | settle `sources`' nullability first |

## Ready to build: small and self-contained

### Grey out the genomic-coordinate option instead of hiding it

`SequenceFeatureDetails/dialogs/SequenceFeatureMenu.tsx` drops the "Coordinates
relative to genome" radio entirely when `showGenomicCoordsOption(mode)` is
false, so the option disappears rather than explaining itself. Render it
disabled, with the reason the label already carries.

### Autofit height for the lineargenomeview example-site demo

No view-level auto-height in `products/jbrowse-react-linear-genome-view`; only
per-track `heightMode` grow/fit (demoed in `examples-site` `WithTrackSizing`).

### Extra large text SVG mode for pub-ready figures

`BaseExportSvgDialog` exposes font *family* only. Text size is per-element
(explicit `fontSize` attrs plus `SvgCanvas` labels), so a scale factor has to
thread through the same path `fontFamily` takes (`wrapSvgExport` →
`SVGExportRoot`) and every explicit `fontSize` has to become relative, or
labels will overflow the boxes laid out for them.

### Alignments / canvas

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

### Report a callout that draws off-frame

`drawAnnotationOverlay` throws on an anchor that resolves to nothing and says
nothing about one that resolves and then draws outside the viewport, which is
how a correct pill shipped invisible for a round (see
[reference/SCREENSHOT_CALLOUT_ANCHORS.md](reference/SCREENSHOT_CALLOUT_ANCHORS.md)).
An item whose drawn rect falls outside the capture is almost always a bug —
report it the way the overlay already reports an unresolvable anchor.

### `partitionField` jexl throws through its own guard on `bigRmskBed`

`LinearMultiRowFeatureDisplay`'s `partitionField` slot documents
`"jexl:split(split(feature.name,'#')[1],'/')[0]"` for exactly this file type,
and it error-banners the whole display with `TypeError: Cannot read properties
of undefined (reading 'split')`. The throw escapes
`makeFeaturePartitionResolver`'s per-feature `catch`, which exists so that one
unparseable name costs its own row rather than the track — so the guard is there
and is not holding. Setting it as a config slot in the track's `displays`
instead of on the view's tracks entry makes no difference.

Two things not to spend time re-finding: jexl's `+` is numeric, so a
`feature.name + '#sentinel'` workaround yields NaN and every feature lands in one
empty row; and the attribute form (`partitionField: 'name'`) works but gives one
row per repeat NAME, which is the outcome the slot's own docs warn about.
`website/scripts/specs/methylation.ts` carries the full write-up beside the lane
that wanted it.

### Render the twenty specs whose callouts were converted to anchors

The anchoring pass landed in the specs and **no figure was regenerated** — the
worktree it was done in carried another agent's in-flight display edits, so a
render there would have baked unlanded work into a committed PNG. So these are
correct in the spec and stale on disk until a sweep picks them up.

`--check` passes at 0.000% on every changed spec (`maf_codon_tooltip` at
0.001%), which is the proof that every anchor resolves — `drawAnnotations`
throws on one that does not, and several gate on what the click produced rather
than only on where it landed. Most are placement-identical by construction.
Five deliberately move, so a reviewer should expect a diff and not read it as
drift:

| figure | what moves | why |
| --- | --- | --- |
| `trio-crossover-paternal` / `-maternal` | frames' OUTER edges, 3px left and 5px right | they were inset from the view; they are now the window's own. The rows, the pitch and the abutment at the crossover are unchanged arithmetic |
| `lgv_usage_guide` | pills and tails, ≤1px | the lift is 59px off the controls' resolved row (y=121.4) rather than y=62 on the page |
| `bookmark_widget_edit_label` | arrowhead, ~8px left and 1px down | it points at the label cell's centre plus a nudge, where it used to be a raw point |
| `linear_align_ctx_menu` | arrowhead ~5px right, pill ≤2px | head and pill now share the click's own anchor |
| `customized_feature_details` / `upstream_downstream_details` | the click, from x=430 to the Apple3 mRNA's midpoint | same feature, same row, furthest point from either end of it |

[reference/SCREENSHOT_CALLOUT_ANCHORS.md](reference/SCREENSHOT_CALLOUT_ANCHORS.md)
is the method, including why the 40 remaining raw coordinates are deliberate.

## Ready to build: the design is settled

Each of these carries a design that already survived a rejected alternative.
Read the linked ADR or reference doc before re-proposing the thing it rejected.

### Give the comparative displays a cancel and a retry

`LinearSyntenyDisplay` and `DotplotDisplay` are the only displays with no way to
stop a slow load or retry a failed one. Every LGV display has both.

This is what is left of the old "fold the non-LGV fetches onto `FetchMixin`"
entry, which
[ADR-054](architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md)
rejected — read it before re-proposing the fold. The short version: it retires
neither stop-token machine (`createStopTokenRotation` has a third consumer that
`FetchMixin` structurally cannot host), most of what it would add is per-region
machinery these single-RPC fetches don't use, and the two getters worth hoisting
read `self.error`, which that mixin cannot see without a third declaration of
`BaseDisplay`'s five status members — the trap ADR-041 records.

**Retry is a button, never automatic.** A failed comparative fetch stays failed
until the user asks again — no backoff, no re-arming on error. This is a
deliberate constraint, not an unfinished half: the displays sit on RPCs that can
be minutes long against remote indexes, so a display that re-fires on its own
hammers a failing server and burns the user's bandwidth with nothing on screen
to say why. Build the manual path only.

The LGV families already encode that split and are the shape to copy:
`cancelFetch` (internal, bumps `fetchGeneration`, deliberately *does* retrigger)
versus `cancelFetchByUser` (durable, deliberately does **not**) exist for exactly
this reason — see the comments on both in `FetchMixin`.

**None of that blocks the feature**, which was the only user-visible thing the
fold was buying:

- `fetchCanceled` volatile + `cancelFetch`/`reload` actions on
  `SyntenyFetchStateMixin` (`@jbrowse/synteny-core`), alongside the `fetching` /
  `loadedFetchKey` / `assembliesSwapped` it already owns.
- `installComparativeFetchAutorun` reads `void self.reloadCounter` in the same
  place it reads `currentFetchKey`, and skips the run while `fetchCanceled` — the
  unconditional-read rule from `installGlobalFetchAutorun` applies, or reload
  dies the moment the gate goes false.
- `LoadingOverlay` already takes `canceled` / `onCancel` / `onRetry`;
  `LinearSyntenyRendering.tsx` passes none of them. Dotplot's
  `DisplayStatusOverlays.tsx` renders a bare `LoadingProgress` and needs the
  overlay proper, or its own buttons.

**The loop to not write.** `prepare` must never read `self.error`. The skeleton
already `setError(undefined)`s at the start of every fetch and `setError(e)`s on
failure, so an `error` read in the tracked half turns a single failure into an
unbounded retry loop — fetch, fail, error changes, autorun refires — paced only
by the debounce, against the server that just failed. Nothing catches this today
because `prepare` happens not to read it; the same hazard is why
`installGlobalFetchAutorun` documents that `rpcProps()` must never return
fetch-derived state.

### Stop uploading every rect twice for the continuation pass

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

### Linearize the pangenome: draw graph variation as alignment-style glyphs

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

#### The record is a CIGAR

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

#### One lane, not rows

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

### Reads on the reconstructed derivative allele

Came out of the screenshot review on `cancer_sv/derivative_autogenerated`, which
asked whether the reconstruction could load the reads across its loci and whether
a wasm minimap2 could realign them to the derived contig.

Three separate things, cheapest first. **The middle one is built** — see
[reference/SV_MULTIHOP.md](reference/SV_MULTIHOP.md), "Reads on the allele"; the other
two are open.

**Reads on the reference panel: already possible, off on purpose.**
`refPanelTrackIds` (`LinearDerivativeVsRef.tsx`) carries every open track onto
the reference panel except `AlignmentsTrack`, because that panel merges every
locus the path touches into one window and a pileup there refetches the reads
already on screen in the launching view. A user can add the track from the track
selector in the launched view. If the default is ever revisited, it's that filter.

Now weaker than it was: the derivative panel carries the reads already, in
derivative coordinates, so what the reference panel would add is the same reads
in the frame that does NOT show whether they agree with the allele.

**minimap2 in wasm: needs bases the feature deliberately does not build.** The
temporary assembly's `FromConfigSequenceAdapter` carries `seq: ''` — "the path is
a structure, not a consensus" — so there is nothing to align against. Getting
bases means either concatenating each segment's reference sequence (revcomp for
inverted segments; available in-app from the sequence adapter, but that is a
*reference-derived* contig, not the sample's) or building a read consensus, which
is what `scripts/sv_multihop.py derive` already does offline with samtools and
minimap2. wasm in the browser is not itself exotic here — `@gmod/bgzf-filehandle`
ships a 29 KB inflate wasm that every BAM/VCF read goes through — but a minimap2
build is megabytes, so it belongs in an external plugin rather than in core for
one menu item.

### What is left of the row-display family, and the one part not worth sharing

The four row displays — `LinearMafDisplay`, `MultiSampleVariantBaseModel` (two
displays), `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay` — all
compose `TreeSidebarMixin`, which is now the row in the cross-cutting table
naming them. Landed 2026-08-07: the declarative clustering trigger
(`runClustering` / `clusterRegion` and their setters) moved onto that mixin, and
the three `getXxxClusterAutorun.ts` wrapper modules are gone —
`setupRunClusteringAutorun` resolves `rpcManager` / `sessionId` itself and each
display passes a `run` callback that code-splits its own RPC module.

Also landed 2026-08-07: **`sources` is a resolved array on all four**. maf and
variants returned `T[] | undefined`; every consumer collapsed the absent case
immediately (`?.length`, `?? []`, `?? 0`) — about twenty defensive reads and no
decision behind any of them, which is why `TreeSidebarModel.sources` had to be
optional. Two maf consumers *were* reading the tri-state, and both were asking
"has the species list arrived", so that got its own name (`sourcesKnown`, over
`sourcesVolatile.length`). The distinction it preserves is real and has a
regression test: an empty `sources` arrives both from "no fetch yet" and from a
fetch that found no rows, and the render callback's first-paint gate must open
for the second (`emptyRegionLoading.test.ts`). The load-bearing `undefined`
stays where it always was, on `sourcesVolatile` / `sourcesBase` — `sampleFilter`
and `fetchNeeded` read those, and the `undefined` → list transition is what
wakes the fetch autorun (ARCHITECTURE.md, "the per-region twin").

Still per display:

- **`hierarchy`**, four copies of one `computeClusterHierarchy(...)` call
  differing only in which expression supplies the content height (and
  multi-wiggle's `isOverlay` short-circuit). Small, and the shared part is
  already the function; a mixin getter would need three hooks it can't type.

**The row-height ladder is deliberately not on this list, and the reasons are
structural rather than stylistic** — worth stating, because two of the three
differences look like drift and are not:

- Canvas caps `effectiveRowHeight` at `maxCanvasHeight / nrow`. It sizes its
  canvas to its content, so nothing downstream bounds the stack.
- Multi-wiggle has no `rowHeight` sentinel at all (always fit) and branches on
  `isOverlay`, which collapses every source onto one plot.
- maf and canvas seed the `height` slot in `setFitToHeight` and variants does
  not. **This is the one that looks like a bug and isn't:** both of those
  *override* the `height` getter to a content-derived value, so `self.height` in
  fixed mode is not the slot and entering fit mode without re-seeding jumps.
  Variants leaves `height` to `TrackHeightMixin`, so the same line would write
  the slot back to itself. Check which `height` a display has before copying
  either one.

What is shared is the part with an actual rule: `resolveRowHeight` (the `0`
sentinel plus the non-positive floor) and the menu row and dialog. A mixin over
the rest is two hooks plus two override points wrapping about four lines of
arithmetic. See
[reference/ROW_HEIGHT_AND_FIT.md](reference/ROW_HEIGHT_AND_FIT.md).

### Offer a file's PanSN prefixes in the all-vs-all add-track form

An all-vs-all track whose JBrowse assembly name is not the file's PanSN sample
prefix used to draw nothing and report nothing. Both adapters now *throw*
`noPanSNMatchError` (`plugins/comparative-adapters/src/util.ts`) naming the
file's samples and the `assemblyNameToPanSN` slot that fixes it, and the region
launcher's dialog separates "no mate aligns" from "mates align but none is a
declared assembly". That was the ten-line half, taken first on purpose: the
error carries the information at the moment it is needed.

What is left is discovery. `AllVsAllAddTrackComponent` collects assembly names
only, and the config editor renders `assemblyNameToPanSN` — a `frozen` slot — as
a raw JSON textarea, so **nothing in the UI ever lists a file's PanSN prefixes**
and the mapping can only be written from `tabix -l`. Read the tabix contig list
in the add-track form and offer a per-assembly prefix dropdown.

Before shipping any further *throw* on an adapter misconfiguration, check every
hosted demo file still resolves:
`tabix -l <url> | cut -c2- | cut -d'#' -f1 | sort -u` (the leading character is
the PIF tier letter). All four `demos/ecoli_pangenome` files were checked that
way.

## Blocked on a visual call

### The synteny clicked outline strokes every match tile in transparent-indel mode

In transparent-indel mode (`drawCIGARMatchesOnly`), `cigarSegmentKind` tags each
match segment `KIND_BASE`, and the outline gate is "not CIGAR, not marker"
(`isClickedSilhouette` in `syntenyTypes.slang`, mirrored in
`Canvas2DSyntenyRenderer`). So a clicked feature gets the side edges of *every*
match tile stroked instead of one silhouette — a ribbon with 300 visible indels
draws ~600 black hairlines. The shader comments say the intent is the clicked
feature's BASE silhouette, so this is accidental kind reuse, not a chosen look.

It is not a one-line fix, which is why it needs the visual decision first.
Giving tiles their own kind so the edge pass skips them leaves a tiled feature
with **no outline at all**, because pass 1 deliberately lays down no full-span
base in that mode (that is what keeps the indels see-through) — `isTiled` in
`buildSyntenyGeometry.ts` is the predicate. Doing it properly means emitting an
outline-only instance carrying the feature hull, which the fill passes must
discard and the pick engine must skip, or it breaks the documented
"pickable ⟺ drawn as a solid fill" invariant. **The call to make: silhouette of
the hull, or per-tile outlines.**

The perf argument that used to ride along with this is gone — the edge pass no
longer draws every instance. `packClickedOutlineInstances` builds a buffer of
just the clicked feature's instances (`GpuSyntenyRenderer.ensureOutlineUploaded`),
so don't reintroduce the HAL `firstInstance`/`instanceCount` range on `drawPass`
for this reason. The corner-order convention these passes read is spelled out at
the top of `syntenyTypes.slang`.

## Measure first: the premise or the cost attribution is unconfirmed

Every entry here opens with a measurement because the obvious build would be
guessing. The instrumentation pattern for the render-path ones is
[reference/PERF_INSTRUMENTATION.md](reference/PERF_INSTRUMENTATION.md).

### Cut WebGL2 contexts per display

The ceiling is **16 live contexts** and one LGV with 17 GPU tracks crosses it —
measured 2026-08-05, same on a real Intel GPU and on SwiftShader, so it is a
browser property. See [reference/ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md)
§"One WebGL2 context per display canvas" for the walk and
[reference/GPU_CONTEXT_BUDGET.md](reference/GPU_CONTEXT_BUDGET.md) for the
harness and the fixes already eliminated.
That was the number this entry used to ask for, and it answers the question it
was gating: an unremarkable session reaches the ceiling, so **track-level
mount/release is worth building**, and so is anything that shares a context
across displays.

Do the cheap environment check first, though. `preferredRenderer` picks WebGL2
whenever a context exists, and under software rendering that is ~25x more
main-thread cost than Canvas2D for the same session (on a real GPU the ordering
reverses, ~2x the other way). Reading `UNMASKED_RENDERER_WEBGL` off the probe
`getGraphicsCapabilities` already creates is free.

### MAF fetch cost on long blocks

Design done, nothing built, premise unconfirmed — see
[reference/MAF_LARGE_BLOCKS.md](reference/MAF_LARGE_BLOCKS.md). Run the one-line block-size
check before building any of it. The byte-gate half is closed: the gate no longer
scales an estimate by span, it re-measures at the viewport it is judging, so a
cost quantized by feature is measured rather than modelled
(REGION_TOO_LARGE.md § "Measurement follows the viewport").

### Alignments still repacks every row-instanced pass on the main thread

ADR-004's open item #3, and now the only large one left on that path: the
per-region upload skip and the layout/color split cut the syncs that repack
*unchanged* data, but a genuine relayout (sort, row height, a new fetch) still
packs read / gap / mismatch / insertion / clip / softclip / modification /
per-base-quality / per-base-letter from scratch on the main thread, because a
read's row isn't known until every visible region is laid out together.

**The fix is not "move layout to the worker"** — that has been proposed and
rejected repeatedly, and
[ADR-053](architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md)
records the four properties that depend on layout staying local. What is
separable is the *pack*.

Y is the only layout-dependent field in most of those structs. Three ways to stop
shipping the rest through a main-thread packer, cheapest first:

- **Worker packs with `y = 0`, main thread patches the Y lane.** One strided
  `u32[o + F.y] = readYs[readIndices[i]]` write per instance replaces the whole
  gather, and the buffer arrives transferable so the pack allocation goes away.
  No shader or HAL change. The catch is that it mutates a worker-owned buffer,
  which is in tension with "per-region upload values must be freshly constructed,
  never mutated" — the upload memo would need a layout-generation token instead
  of `readYs` identity.
- **Y as a second instance buffer** (divisor 1 on GL, a second `vertex.buffers`
  entry on WebGPU). `PassDescriptor` and both HALs grow multi-buffer support;
  relayout then uploads a `Uint16Array` per pass instead of the full struct.
- **Y as an indirection** — instances carry `readIndex`, the shader reads the row
  from a per-read table. Makes relayout O(reads) rather than O(bases) and deletes
  `cloneWithLayout`'s `remapYs` entirely (Canvas2D can index
  `readYs[mismatchReadIndices[i]]` at draw time). Needs region-keyed textures
  (`uploadTexture` is per-pass today) plus a `.slang` edit per row-instanced
  pass.

**Measure before building.** Nobody has profiled the split between `pack*`,
`uploadBuffer` and `cloneWithLayout` on this tree; the instrumentation pattern is
[reference/PERF_INSTRUMENTATION.md](reference/PERF_INSTRUMENTATION.md). Do it at a deep
pileup with per-base quality on, which is where the per-base passes (one instance
per base per read) dominate — at gene-scale defaults the read pass alone may not
justify any of this.

Related and independent: both HALs `deleteBuffer` + recreate on every
`uploadBuffer` (`webgpuHal.ts` `createVertexBuffer`, `webgl2Hal.ts`
`bufferData`). Reusing the allocation when capacity allows would drop the churn
for every plugin, and a stable buffer identity is also what would let WebGL2
cache a VAO per (region, pass) instead of re-running `bindAttributes` on each
`drawPass`.

### Stop rewriting the worker's arrays to lay out features

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

### `featureItemMap` is an O(N) build serving a handful of point queries

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

## Auto-detect when to use first-of-pair strand?

we already have smart 'sashimi' settings
could add a 'token' on bottom right of display similar to auto for gene glyphs
