---
name: todo
description: The backlog — action items to build or fix, grouped by how ready each one is: small and self-contained, designed and ready to build, or blocked on a measurement that has to come first. Read when picking up work.
---

# Backlog

Grouped by **what you have to do first**, because that is the thing most of these
entries actually disagree on. Roughly two fifths are ordinary build work; a
quarter carry a design that survived a rejected alternative and needs following
rather than re-deriving; most of the rest open with an instruction to go measure
something, because the premise or the cost attribution is not established and
building first would be guessing. Three are blocked on a visual call that is not
the implementer's to make.

Exploratory concepts that are *not* committed work live in
[ideas/](ideas/README.md), one file per proposal.

**The index below is checked, not merely written.**
`website/scripts/check-todo-index.ts` (under `pnpm check-docs`) fails when a
`###` here has no row or a row points at a heading that does not exist — it
cannot check the `Area` and `First move` columns, which are editorial, but the
half that rots is the half it covers. It exists because this table drifted twice
before anyone noticed.

| Item | Area | First move |
| --- | --- | --- |
| [Grey out the genomic-coordinate option](#grey-out-the-genomic-coordinate-option-instead-of-hiding-it) | feature details | render the radio disabled |
| [Validate the react-app site's volvox config](#run-jbrowse-validate-over-the-react-app-sites-volvox-configjson) | embedded, config | 8 errors already reported; fix the file, then ask why it is a copy |
| [Pool the coordinate ruler's tick divs](#pool-the-coordinate-rulers-tick-divs-so-a-zoom-stops-rebuilding-them) | LGV, perf | measured; a fixed pool is the low-risk version |
| [Emit the shader constants as their own module](#emit-the-shader-constants-as-their-own-module) | shaders, bundle | the fix is in the codegen, so it answers to the Shaders CI job |
| [Extra large text SVG mode](#extra-large-text-svg-mode-for-pub-ready-figures) | SVG export | thread a scale the way `fontFamily` threads |
| [Alignments / canvas odds and ends](#alignments--canvas) | alignments, canvas | six independent small items |
| [Verify the overlay palettes in dark mode](#verify-the-overlay-palettes-in-dark-mode) | alignments | open a pileup with arcs, dark theme, look |
| [Audit the wiggle colour paths for the same split](#audit-the-wiggle-colour-paths-for-the-same-split) | wiggle | read `sourcesLogic.ts` against its legend |
| [What colour is an arc with no pair orientation](#what-colour-is-an-arc-with-no-pair-orientation) | alignments | a visual call, then one of two edits |
| [Make the capture scroll-invariant](#make-the-snapshot-capture-scroll-invariant-then-widen-the-gate-to-webgpu) | browser tests | it is `snapshot.ts`, not a shader — attribution is done |
| [Widen `CI_GATE_SUITES`](#widen-ci_gate_suites) | browser tests, CI | measure before adding; say why the alignments pair is safe |
| [Attribute the TIMEOUT mode](#attribute-the-browser-test-timeout-failure-mode) | browser tests | report the display's state, don't extend the wait |
| [Make the webgl blank verdict readable](#make-the-webgl-blank-verdict-readable) | browser tests | one diagnostic run; never leave it on |
| [Report a callout that draws off-frame](#report-a-callout-that-draws-off-frame) | figures | the overlay already reports the unresolvable case |
| [Overlay labels cover the row below](#overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes) | canvas | decide: reserve a row, or call overlay normal-mode only |
| [Render the converted callout specs](#render-the-twenty-specs-whose-callouts-were-converted-to-anchors) | figures | sweep them; five move deliberately |
| [Comparative cancel and retry](#give-the-comparative-displays-a-cancel-and-a-retry) | synteny, dotplot | read ADR-054 first; retry is a button, never automatic |
| [Stop uploading every rect twice](#stop-uploading-every-rect-twice-for-the-continuation-pass) | GPU canvas | unify `ATTR4`, then verify headed on both backends |
| [Linearize the pangenome](#linearize-the-pangenome-draw-graph-variation-as-alignment-style-glyphs) | pangenome | read PANGENOME_GRAPHS.md — four findings constrain the layout |
| [Pangenome graph view queue](#pangenome-graph-view-the-open-queue) | pangenome | three items unblock the rest; take the LGV axis first |
| [Collapse trivial bubbles in a file-loaded graph](#coarsen-a-graph-loaded-as-a-file-collapse-trivial-bubbles) | pangenome | designed; path lanes are the open question |
| [Reads on the derivative allele](#reads-on-the-reconstructed-derivative-allele) | cancer SV | two open halves; the middle one is already built |
| [PanSN prefixes in the add-track form](#offer-a-files-pansn-prefixes-in-the-all-vs-all-add-track-form) | comparative | the error half shipped; this is the discovery half |
| [Synteny clicked outline in tiled mode](#the-synteny-clicked-outline-strokes-every-match-tile-in-transparent-indel-mode) | synteny | get the visual call — hull silhouette or per-tile |
| [Observer reactions leak from discarded renders](#destroying-an-mst-tree-that-something-still-observes) | app-core, drawer | give each lazy its own Suspense boundary; verified 2 leaked -> 0 |
| [Cut WebGL2 contexts per display](#cut-webgl2-contexts-per-display) | GPU, limits | build — ceiling measured at 16, one ordinary view crosses it |
| [MAF fetch cost on long blocks](#maf-fetch-cost-on-long-blocks) | MAF | run the one-line block-size check; premise unconfirmed |
| [Produce and host the HPRC summary tier](#produce-and-host-the-hprc-summary-tier) | MAF, pangenome | one streaming pass over the TAF, then an S3 write |
| [A TPA reader](#a-tpa-reader) | pangenome | no reader exists; 466 files ship |
| [Byte-native MAF adapter path](#a-byte-native-maf-adapter-path-once-tabix-js-publishes-linebytescallback) | MAF | blocked on a tabix-js publish; measure the pack stage, not the decode |
| [Dense-lane SNP change on a deep pileup](#measure-the-dense-lane-snp-change-on-a-deep-pileup) | alignments | direction safe, magnitude unmeasured |
| [Alignments main-thread repack](#alignments-still-repacks-every-row-instanced-pass-on-the-main-thread) | alignments, GPU | profile the pack/upload/clone split first |
| [Stop rewriting the worker's arrays](#stop-rewriting-the-workers-arrays-to-lay-out-features) | canvas | count the consumers — they decide if it is worth it |
| [The SV inspector rebuilds its chord track per filter](#the-sv-inspector-rebuilds-its-chord-track-from-the-whole-callset-per-filter) | SV inspector | time it on a callset in the thousands, not the 44-row table |
| [What is left of the row-display family](#what-is-left-of-the-row-display-family-and-the-one-part-not-worth-sharing) | maf, variants, canvas, wiggle | settle `sources`' nullability first |
| [One inflate pool and byte cache per session](#give-the-rpc-workers-one-inflate-pool-and-one-byte-cache-between-them) | bgzf, RPC, limits | the speed premise is measured out; weigh the wasm memory, or close it |

## Ready to build: small and self-contained

### Grey out the genomic-coordinate option instead of hiding it

`SequenceFeatureDetails/dialogs/SequenceFeatureMenu.tsx` drops the "Coordinates
relative to genome" radio entirely when `showGenomicCoordsOption(mode)` is
false, so the option disappears rather than explaining itself. Render it
disabled, with the reason the label already carries.

### Run `jbrowse validate` over the react-app site's volvox-config.json

`products/jbrowse-react-app/examples-site/src/volvox-config.json` is a private
copy of the volvox config, drifted from the canonical one, and the validator
reports **8 errors** on it — three `pileupDisplay` and three `renderers` blocks
that are neither slots nor properties, plus two tracks naming assemblies the
file never defines (`wombat`, `volvox_del2`). Every one is silent at runtime.

The equivalent bugs in the lineargenomeview site's `nextstrain_*.json` are
fixed, and its generator now refuses to write an invalid config (`gen-nextstrain-
demos.mjs`, `assertConfigValid`). This one has no generator, so the fix is to
correct the file and then decide whether it should be a copy at all — the two
`renderers`/`pileupDisplay` shapes are pre-slot spellings that suggest it was
forked before the config migration and never re-synced.

Doing this for every site at once means the check belongs in
`runExamplesSiteChecks` (`@jbrowse/browser-test-utils`), which would put
`@jbrowse/cli` in all four sites' installs for one function — weigh that against
two fixtures.

### Pool the coordinate ruler's tick `<div>`s so a zoom stops rebuilding them

`ScalebarCoordinateLabels` (`plugins/linear-genome-view`) creates and destroys
~144 tick nodes per zoom click. Its `key`-by-base reuse works for *pan* (the
same bases scroll across) but not *zoom*: the scale changes, so the tick set and
its keys change every frame, React tears down and rebuilds the whole list, and
each new node pays the emotion/tss `tickLabel` styling cost. This is the
measured dominant source of per-frame DOM churn during interaction — 719
structural add/removes plus 439 style-attr mutations out of ~2056 attributed
during a 5× zoom, against **2 of 2056** in the alignments overlays, which are
already zoom-invariant and should not be chased.
[reference/INTERACTION_PERF.md](reference/INTERACTION_PERF.md) has the
measurement and the repro tooling.

Lowest-risk fix first: a fixed pool of tick `<div>`s that is repositioned and
relabelled rather than added and removed — kills the structural churn and keeps
accessible DOM text. Alternatives if that is not enough: a canvas ruler (bigger
win, loses selectable text), or coarsening ticks off `coarseBpPerPx` during the
zoom spring and snapping exact on settle.
### Emit the shader constants as their own module

`plugins/alignments/src/shaders/slang/read.iface.generated.ts` is the next eager
-bundle item, already attributed and banked into the examples sites' committed
figures (~11 KB on `synteny`). Its eager consumers
(`LinearAlignmentsDisplay/constants.ts`, `colorUtils.ts`) want ten `CS_*`
integers; the module also carries `writeUniforms`, 10.7 KB of its 20.6, for the
lazy renderer — so the eager import pays for the whole thing. Same shape as the
breakpoint-split-view case in
[EAGER_BUNDLE.md](reference/EAGER_BUNDLE.md) §"A duplicate is how a bundling
split looks from the inside", one plugin over.

The fix is in the shader codegen rather than in either consumer, which means it
regenerates every shader in the repo and answers to the Shaders CI job — its own
change, not a lint-sized one.

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
- Say how many features are under the cursor in a collapsed pileup,
  `plugins/canvas`. The density collapse pins sub-pixel marks to row 0, where
  several share a pixel column; `performMultiRegionHitDetection` resolves the
  topmost, so the rest can be seen (they fade, so the column's opacity tracks
  how many there are — `pileupFadeIds`) but never inspected. The count is
  already in hand at hit time: the flatbush search returns every match before
  `topmostMatch` picks one. A tooltip line ("+3 more here") is probably the
  whole job; a click-to-list is the larger version.

### Verify the overlay palettes in dark mode

`shaders/palettes.ts` now resolves the arc and linked-read palettes through the
themed `ColorPalette`, which fixed reads being dimmed in dark mode while the
arcs over them were not (the stock dark palette changes exactly one entry,
`pairLR`). That fix is verified by tests over the tables and **has never been
looked at**. Open any figure's locus with `readConnections: 'arc'` in the dark
theme and check the arcs, the read-cloud squares, the connectors and the reads
under them read as the same greys. It is the last claim in
[ALIGNMENTS_COLOR_PARITY.md](reference/ALIGNMENTS_COLOR_PARITY.md) resting on
reasoning rather than observation.

While there: `arcColorsMatchReads` (the getter deciding whether the arc key
folds into the read key) has no test, because it is a model getter and the
parity tests exercise the classifiers instead. It is still load-bearing — the
arcs can emit `splitInversion` where a non-chain-mode read scheme does not.

### Audit the wiggle colour paths for the same split

The alignments plugin turned up three instances of one failure mode — a colour
or label table duplicated across two paths, agreeing by comment rather than by
derivation, and agreeing only in the default theme with well-formed data. All
three are written up in
[ALIGNMENTS_COLOR_PARITY.md](reference/ALIGNMENTS_COLOR_PARITY.md).

`plugins/wiggle` has the same shape and has not been looked at:
`MultiLinearWiggleDisplay/sourcesLogic.ts` carries a three-mode colour model
(overlay / multirow / density, with identity displaced to `labelColor` in
density) and `legendItems.ts` derives the key separately. The question to ask is
the one that found the others: does the legend derive from the table the
renderer paints, or restate it.

### Make the snapshot capture scroll-invariant, then widen the gate to webgpu

Baselining, localization and attribution are all done — see
[reference/CROSS_BACKEND_GATE.md](reference/CROSS_BACKEND_GATE.md) and
[reference/SCREENSHOT_CAPTURE_RACE.md](reference/SCREENSHOT_CAPTURE_RACE.md).
The drift is pre-existing, it is one 37px strip, the render is correct, and the
strip is app chrome composited into the canvas after `el.screenshot()` scrolled
the element under it in Firefox and not in Chrome.

So the work is in `snapshot.ts`, not in a shader: either size the viewport so the
display needs no scroll, or scroll to a fixed position before capturing, applied
to both sides of every pair. **The canvas rect must be unchanged across the
capture on every backend**, which is the property that was violated. Re-run
`browser-tests/probe-webgpu-coverage.ts` afterwards. Widening the gate to webgpu
is blocked only by this.

### Widen `CI_GATE_SUITES`

Add `Alignments Track` and `Alignments Color Schemes` first — tight drift, clean
3/3 — and **say in the commit that this is safe only because CI runs
`--skip-webgpu`**, or the next person widening to webgpu gets eight failures and
no context. Hold `Long Reads and Inversions`: it would buy four pairs whose
passing verdict is a 5–17% divergence the gate is configured to ignore.

Then the local deterministic suites never measured under swiftshader — arcs,
workspaces, redraw, cursor-guides, svg-export, custom-url, variant-force-load.
Arcs and workspaces carry overrides tuned on a real GPU, so **measure before
adding**; that is the whole procedure, and it is a measurement, not an edit.

### Attribute the browser-test TIMEOUT failure mode

The other failure mode next to blank captures: a display never reports `-done`
inside 60 s. Apply exactly the move that worked for blanks — when the wait
expires, report what state the display is actually in (`data-display-phase`,
whether the wrapper exists at all, whether an error banner is up) instead of an
opaque timeout. `waits.ts` already notes the likely shape: a display in a
terminal `tooLarge`/`renderError` state renders no wrapper and so can never
report done, which reads as a timeout forever.

An earlier attempt was reverted (`839113dabe`) — re-query the selector per
attempt rather than holding the handle, and prove the mechanism on a targeted
reproduction first.

### Make the webgl blank verdict readable

Half the blank captures are unattributable today: a canvas2d blank self-reports
"HAS content" and is conclusive, a webgl one self-reports "ALSO blank" and is
not, because a cleared drawing buffer reads identically. Turning
`preserveDrawingBuffer` on temporarily makes webgl's self-report conclusive, via
an `evaluateOnNewDocument` override of `getContext` verified against a plain
canvas first. **This is one deliberate diagnostic run, not another A/B, and it
must not be left on** — it was measured and refuted as a *fix*
([reference/CROSS_BACKEND_GATE.md](reference/CROSS_BACKEND_GATE.md)).

### Report a callout that draws off-frame

`drawAnnotationOverlay` throws on an anchor that resolves to nothing and says
nothing about one that resolves and then draws outside the viewport, which is
how a correct pill shipped invisible for a round (see
[reference/SCREENSHOT_CALLOUT_ANCHORS.md](reference/SCREENSHOT_CALLOUT_ANCHORS.md)).
An item whose drawn rect falls outside the capture is almost always a bug —
report it the way the overlay already reports an unresolvable anchor.

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

### Pangenome graph view: the open queue

Read [reference/PANGENOME_GRAPHS.md](reference/PANGENOME_GRAPHS.md) first — the
files, the measured costs and the decisions that look like bugs are all there.
**Take them in this order**, because three of them unblock the others.

**1. The graph takes `scaleX`/`translateX` from the connected LGV.** When
`connectedViewId` is set, read `bpPerPx`/`offsetPx` from that view. y-in-px
shipped, so this is a change to x alone. It is what `hprc_mhc_anchored` needs —
that figure's whole argument is a shared axis, and today the segments lane spans
the full pane while the backbone starts after `FIT_PADDING` (40) plus the
row-label gutter. Sharing a coordinate system is not sharing a pixel mapping.

Not to re-derive: **the anisotropy does not belong in the transform uniform**,
even though the uniform has carried `scaleX`/`scaleY` all along. Most of the
drawing mixes the axes in a single `hypot` — a chord length, a tangent
projection, a deletion's bow, a mitred normal, an arrowhead's angle, a hover
distance — and each is nonsense the moment x is bp and y is px, so the conversion
(`yToX = scaleY/scaleX`) has to happen where the geometry is built.
`geometry.test.ts` asserts `yToX === 1` is the *identity*, not merely close,
which is what keeps the committed FMMM figures byte-stable.

**2. Follow that view's region, so the window is navigable from inside.**
`loadedRegion` is written once by the launch and no action changes it
(`refetchIfNeeded` returns early when `self.graph` is set), so seeing the next
60 kb means going back to the linear view and rubber-banding again. Fetch cost
does not scale with window size (~1.3 s, dominated by HTTP setup). Once item 1 is
reading the transform, this is a debounced refetch when the region leaves
`loadedRegion`, under `MAX_GRAPH_REGION_BP` with the existing "zoom in to view
graph" message past it. A locstring field plus widen/narrow buttons is the
fallback if following fights the user.

**3. The view picks a tier by `bpPerPx`**, the way
[SYNTENY_LOD.md](reference/SYNTENY_LOD.md)'s two PIF tiers already do — config is
a prefix per tier plus its bp range, and there is no new rendering mode. Then
**expand-on-click** (PangyPlot's `/pop`): the tier node id *is* the bubble's
source segment, so expanding is a fine-index query over the same span with no
cross-reference to maintain. This retires `maxRegionBp`, which is the interim
mechanism.

Then, in no particular order:

- **Draw a node once per carrier.** `sampleRowLayout` emits one position per node
  id and the renderer keys geometry by that id, so real multi-row carriage needs
  synthetic per-carrier ids plus hit detection resolving them back.
- **Let a row set be requested.** Rows come from whoever contributed to the
  window, so a graph cannot be lined up row-for-row with a genotype matrix of
  chosen donors — which is what `hprc_graph_vs_callset`'s open verdict asks for.
  An explicit list of samples to row (empty rows included) would make the two
  panels comparable, pin the order across windows, and let the graph label
  `HG00642.1` where the callset labels `HG00642 HP0`.
- **Kill the 12 s `fetch`.** The reference-only index was built and does *not* buy
  it: `subgraphContext` defaults to **1 hop**, and a hop follows allele interiors,
  which are indexed under exactly the donor contigs the small pair drops — so
  pointing the graph cut at it silently returns the context-0 graph with no error
  to notice (measured on C4: context 0 agrees at 30/36, context 1 and 2 differ).
  The small pair is for a segments track drawn on the reference. What would
  actually do it is making the hop reach donor rows without indexing every donor
  contig — a third small file keyed by segment id for allele interiors, or a link
  row carrying enough interior that no second query is needed. Producer plus
  adapter change, not a config swap.
- **Regenerate the graph figures.** Every published one still shows the
  pre-`ROW_HEIGHT_PX` pitch. The change moves every anchored figure by design,
  which is exactly why it must not go out piecemeal.
- **`graph.slang` would stretch every stroke's half-width by `scaleY/scaleX` on a
  row layout.** Dead code today — `createGraphRenderer` returns Canvas2D
  unconditionally — but `GraphRenderer.ts` states the one-token fix for whoever
  lands a GPU backend.
- **Launch the graph view from a clicked segment.** The data side is ready:
  `links.bed` states both endpoints in full, precisely so a reference segment can
  reach an off-reference neighbour. The affordance belongs in the plugin repo.
- **Regenerate `pangenome/hprc_whole_chromosome` against the current plugin
  pin.** It was excluded from the pin-bump regen because another agent had an
  uncommitted `hprc_bubble_score` variability track in the same spec, and
  regenerating would have folded their change in.

### Coarsen a graph loaded as a FILE: collapse trivial bubbles

Designed, not built. The tier route above does not reach this case: a tier is a
hosted segs/links pair, and a figure like `pangenome/pggb_haplotype_paths` loads
a GFA through `gfaLocation` because the tabix cut has no P lines and `drawPaths`
would have nothing to draw. A file has no tier to switch to, so its coarsening
has to happen in the view.

**The complaint is arithmetic, not taste.** `ecoli_pggb_is5.gfa` is 20 segments /
26 links / 5 paths over 1,414 bp, and twelve of the twenty segments are 1 bp. The
figure runs `bubbleSpread: 'open'`, whose floor is `2.5 * MEAN_NODE_LENGTH` = 100
FMMM units, and `bandageAutoScale` puts this graph at 0.566 units/bp — so
everything under 177 bp clamps, which is nineteen of the twenty nodes. Drawn
length is 19 × 100 + 678 for the 1,199 bp IS5 arm = 2,578 units, of which the
twelve 1 bp alleles hold **47% while carrying 0.8% of the sequence**, and the arm
the figure is about holds 26% while carrying 85%.

**The shipped levers cannot fix it**, which is why this is a mechanism and not a
spec edit: `auto` draws the alleles proportionally, as specks with no length for
a path lane to run along — the thing the floor was added for — and `compress`
pulls the arm toward the mean and piles its five ribbons into colour confetti.
Both were rendered and rejected (see BUBBLE_SPREADS).

**Collapse the bubble, and that is what lets the floor come off.** The two are
one change: the floor exists only to give a bubble's ARMS room to separate, and a
collapsed bubble has no arms. With both, this graph is 13 nodes at 0.368
units/bp, the IS5 arm at 441 units against 79 for everything else — the arm
becomes 85% of the drawn length, which is its share of the sequence.

In build order:

- **A pure pass over `Graph`, after parse and before layout.** Not a renderer
  change: a collapsed bubble already satisfies the segs contract (a reference
  span, an id, a rank). `collapseTrivialBubbles(graph, { maxAlleleBp })`
  returning a new graph plus the map from collapsed id to the nodes behind it.
- **Detection without BubbleGun.** The singleton-arm case is the one that matters
  and is a local test: a source with k > 1 out-links to distinct nodes, each with
  exactly one in and one out, all converging on one sink, every arm under
  `maxAlleleBp`. In this file that catches four of the six bubbles; the fifth is
  a nested superbubble needing the real algorithm, and the sixth is the IS5 event
  itself, which must NOT collapse — `maxAlleleBp` handles that on its own.
- **The floor becomes conditional on there being arms.** A `bubbleSpread` floor
  applied to a collapsed node is the same bug one level down.
- **Path lanes are the open question, and why this figure is the test case.**
  Every path traverses a collapsed unit, so lanes drawn the current way say "all
  five carry it" — the exact opposite of the carriage claim the figure exists
  for. Worth building: colour the collapsed node's lanes by WHICH allele each
  path took, which says strictly more than the picture does today. The fallback,
  suppressing collapsing while `drawPaths` is on, leaves this figure as it is and
  buys nothing.
- **Expand on click**, as above. For a file-loaded graph the arms are already in
  memory, so it is view state rather than a fetch — cheaper here than on the tier
  route.

Two findings already paid for, so they are not re-priced: **chain contraction is
the wrong primitive** (ADR-014 measured `vg mod -u` at 0.95% on HPRC chr20,
because at 90 haplotypes almost no node has bidirected degree 2), and
**BubbleGun as published does not reach human chr1** (the PangyPlot team measured
chrY 2 s / 1 GB, chrX 30 s / 11 GB, chr9 ~40 min / 13 GB, chr1 hanging at
15+ GB). PangyPlot's second mechanism — merging degree-2 runs into polylines and
grid-snapping — does not apply either: on chrY hprc.clip 39.4% of segments are
junctions and the mean linear run is 2.8 segments, so RDP tops out at 59.5% and
only grid snapping reaches 99%. That is a layout-space simplification for an
overview, not something that makes one 20-node window legible.

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
wakes the fetch autorun (ARCHITECTURE.md §"The global-fetch trigger list").

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

### What colour is an arc with no pair orientation

The last meaning still split between the read fills and the arc overlay. A pair
with `po === 0` is `nonSplit` to the reads — deliberately the neutral grey,
"distinct from the strand-colored split segments" — and the arcs have no such
slot, so they fall to their baseline, `pairLR`. `swatchPaletteKeys` maps those
to `colorNostrand` and `colorPairLR`: two greys, not the same grey, and two
legend rows for one thing. Pinned by the last `describe` in
`shaders/overlayPaletteParity.test.ts`.

Two ways to close it, and the choice is visual rather than structural:

- **Give the arcs a `nonSplit` slot.** Correct, and the wider change: the Slang
  `arcColor` uniform grows by one entry, `ARC_SLOT_CATEGORY` gains a row, and
  the shader's own CI job covers it. An unknown-orientation arc then draws the
  same grey as the read under it.
- **Stop distinguishing it on the read side.** Smaller, and gives up a
  distinction the read fills document as deliberate.

Everything else these two classifiers once disagreed about now derives from one
table, so this is the whole of what is left.

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

### `overlay` subfeature labels swallow the row below them in compact modes

An `overlay` subfeature label puts its top at the box's top (`relativeY =
-featureHeight` in `createTranscriptFloatingLabel`) and reserves nothing, by
design — that is what "overlay" means. The label is drawn at
`labelFontSize(displayMode)` while the box is `featureHeight ×
HEIGHT_MULTIPLIERS`, and those two shrink on different curves, so the spill past
the bottom of the box grows as the mode gets denser:

| mode | box | label | spill |
| --- | --- | --- | --- |
| normal | 10px | 11px | 1px |
| compact | 6px | 8.25px | 2.25px |
| superCompact | 3px | 7.15px | 4.15px |

In superCompact the label more than covers the transcript under it. Measured
2026-08-11 while evaluating overlay as a compaction for `below` (it was rejected
for this reason — see REJECTED_IDEAS.md).

**The call to make: is this a bug or the contract?** Reserving a row for overlay
in compact modes is now cheap — the `labelRowsAbove` channel exists and the main
thread already spends it (`FeatureLayout.labelRowsAbove`) — but it stops overlay
being free, which is the only reason to pick it over `below`. The alternative is
to say overlay is a normal-mode affordance and document it. Not the
implementer's call, hence here rather than in the small-items section.

## Measure first: the premise or the cost attribution is unconfirmed

Every entry here opens with a measurement because the obvious build would be
guessing. The instrumentation pattern for the render-path ones is
[reference/PERF_INSTRUMENTATION.md](reference/PERF_INSTRUMENTATION.md).

### Destroying an MST tree that something still observes

The residue of the setSession fix, and the one part of this area still open.

`setSession` no longer destroys the outgoing session inside its own action — it
detaches, and destroys on a later task — so the in-action window is empty, and
deterministically so: while components are still mounted over that session,
nothing reads a dead node. It was 19 reads on an ordinary volvox session; it
is 0.

What is left is the teardown itself. Destroying a detached tree invalidates
computeds *inside* it that something still observes, and MobX recomputes them
against the nodes being killed. In jsdom that is 0-3 reads per switch; in a real
browser, 14 — against 19 before the fix, so the console noise barely moved, and
that is the honest summary of what the fix bought here. Every read measured on
this path, before and after, is of a scalar or a reference — `type`, `view`,
`trackContainerId` — which warns and cannot throw. The crash shape that makes
this a rule elsewhere, an unmaterialized *complex* child, is the loader path's
(#5618) and was not found under `setSession`. What did change is placement: the
remaining 14 are plain reads (`Action: ''`) on a detached tree with nothing
rendering it, where before they were inside the action with components mounted
over them.

**Waiting longer does not help, measured.** Deferring the destroy 250ms instead
of 0 gave 16 rather than 14, i.e. noise. So the residual is not a race with
React finishing its unmount, and no amount of delay is the fix — which is what
makes the next paragraph the actual one.

**The answer is not an `isAlive` guard in the getter.** That was tried and
reverted. A model getter defending itself against its own node being dead is a
band-aid over the real problem — that something is still observing a computed on
a tree being destroyed — and it did not even work: the residual stayed flaky,
because the next getter along has the same exposure.

**What still observes it has been identified.** Read
`_getGlobalState().trackingDerivation` at the moment of the warning and walk up
`observers_` to the derivations with no observers of their own, and it is the
same four every run:

```
ComputedValue :: HierarchicalTrackSelectorWidget.trackContainer
  observed by  Reaction :: observerHierarchicalTree
               Reaction :: observerBadgeDropdownTracks
               Reaction :: observerTrackCheckbox
               Reaction :: observerOverrideBadge
```

Those are mobx-react `observer()` component reactions, all of them in the
track-selector drawer. Two things narrow it further:

- **They are live, not awaiting collection.** mobx-react-lite disposes a
  reaction either on unmount or through a `FinalizationRegistry` when the
  component is collected, so "abandoned reactions from renders React discarded"
  was the obvious theory. It is wrong: forcing `global.gc()` before the destroy
  changes the count not at all. Something holds them strongly.
- **The drawer spans the swap.** Old and new sessions carry the same widget
  keys (`hierarchicalTrackSelector`, `GridBookmark`), so the drawer is mounted
  continuously across it, and its subtree is the natural candidate for React to
  reconcile rather than remount — leaving those reactions pointed at the old
  widget until they next render.

**They never go away, and StrictMode is what decides it.** Take the old widget's
`trackContainer` ComputedValue, count its `observers_` across a switch, and flip
RTL's `reactStrictMode`:

| | observers before | after the switch | dead reads |
| --- | --- | --- | --- |
| StrictMode off | 20 | **11** | 2 |
| StrictMode on | 11 | **0** | 0 |

Reproducible both ways. So StrictMode is not the cause of the surviving
reactions — it is the cure, and its absence is the bug. Without it, roughly half
the `observer()` reactions in the track selector (`observerOverrideBadge` ×7 of
14, `observerBadgeDropdownTracks` ×2 of 4) are never disposed. They stay
attached to the old widget's computed permanently, and a forced `global.gc()`
does not reap them, so they are strongly held rather than awaiting
finalization — mobx-react-lite's `FinalizationRegistry` path is not what this
is. StrictMode's extra mount/unmount cycle evidently drives the disposal that
the plain path skips.

**That makes it production-only.** `products/jbrowse-web/src/index.tsx` wraps
the root in `<StrictMode>`, which double-invokes in a development build and is
a passthrough in a production one. So a developer never sees this, and the
shipped bundle has it — which is a fair account of why this area reads as
perennially flaky, and it matches the browser measurement, taken on a
production build, still showing a residual after the setSession fix.

Two consequences, and the second is the reason to care past console noise:

- Destroying the outgoing session is loud because these still observe it. That
  is the residual this entry is about.
- Reactions that never dispose keep the old tree **observable and reachable**,
  which is the likely explanation for the `WeakRef` measurement recorded in the
  rootModel `detach` comment: a superseded root still resolving after a forced
  gc, including one that had been `destroy`ed. That was logged as unexplained;
  this is the candidate.

**Why the non-StrictMode path skips disposal.** `useObserver` creates the
reaction during *render*, and has exactly two ways to dispose it:

- the cleanup returned from its `useSyncExternalStore` `subscribe`, which React
  calls on unmount — and only ever calls for a render it **committed**;
- `observerFinalizationRegistry`, registered as
  `register(admRef, adm, adm)` — keyed on the React **ref object**, so it fires
  only when React's hook state for that component is garbage collected.

mobx-react-lite is explicit that the second exists for the first's gap:
"StrictMode/ConcurrentMode/Suspense may mean that our component is rendered and
abandoned multiple times, so we need to track leaked Reactions."

The gap is real here, and this is the measurement that shows it rather than
infers it: after an ordinary load, **14 `observerOverrideBadge` reactions exist
and `document.querySelectorAll('[data-testid^="htsTrackLabel-"]')` finds zero
rows**, with zero disposals recorded. Reactions with no DOM behind them are
components React rendered and threw away — never committed, so never mounted,
so never unmounted, so the `subscribe` cleanup never ran. And the registry
cannot save them because React keeps the ref: six forced `global.gc()` calls
move the count not at all.

With `reactStrictMode` the same load produces 7, and all 7 are disposed at the
switch. Without it, 14, of which 7 survive forever.

**Narrowed to a 30-line reproduction, with no jbrowse in it.** One `observer()`
component inside a `Suspense` boundary where something else suspends leaks a
Reaction per discarded pass:

```tsx
const box = observable.box(1)
const Obs = observer(function Obs() {
  return <div data-testid="obs">{box.get()}</div>
})
const gate = new Promise<{ default: ComponentType }>(res => { release = () => { res({ default: () => <div /> }) } })
const Lazy = lazy(() => gate)

render(
  <Suspense fallback={null}>
    <Obs />
    <Lazy />
  </Suspense>,
)
// observers of `box` here: 2
await act(async () => { release(); await gate })
// observers of `box`: 3, with ONE <Obs> in the DOM, and six forced
// global.gc() calls do not reduce it
```

Control, the same component with nothing suspending: **1 observer, 1 in the
DOM**. So the leak is the suspending sibling, not the component.

The structural match in the app is exact and doubly so.
`packages/app-core/src/ui/App/App.tsx` renders
`<Suspense fallback={null}><DrawerWidget session={session} /></Suspense>` with
`DrawerWidget` itself `lazy()`, and the track selector's own `ReactComponent` is
`lazy()` again (`HierarchicalTrackSelectorWidget/index.ts`), with more lazy
dialogs below it in `HamburgerMenu.tsx` and `TrackCategory.tsx`. Every one of
those is a chance for a pass to be discarded, and every `observer()` rendered in
that pass keeps a Reaction for the life of the tab.

That is the whole chain: lazy inside Suspense discards a render → the reaction
created during it is never subscribed, so never disposed → the registry cannot
collect it because React holds the ref → it goes on observing whatever it read,
which is how a destroyed session still has observers.

**There is a fix, and it is ours rather than upstream's.** React discards the
render of everything inside the *nearest* Suspense boundary, so a boundary
shared between an `observer()` and a `lazy()` is what does the damage. Give the
lazy its own:

| | while suspended | after resolve | in DOM | leaked |
| --- | --- | --- | --- | --- |
| `<Suspense><Obs/><Lazy/></Suspense>` | 2 | 3 | 1 | **2** |
| `<Obs/><Suspense><Lazy/></Suspense>` | 1 | 1 | 1 | **0** |

Same components, same lazy, same timing — only the boundary moves, and the leak
goes to zero.

**Do not file this upstream as a bug.** It was checked before recommending, and
mobx-react-lite already knows: `useObserver` on `main` is unchanged from the
version here, and mobx-react-lite#332 introduced the `FinalizationRegistry`
deliberately for this exact case, on the stated grounds that "React no longer
guarantees it will call cleanup functions". GC-based disposal is the intended
remedy and its non-deterministic timing is a documented caveat, not an
oversight. A report saying "reactions from uncommitted renders are not disposed
promptly" would be restating their design.

What that leaves is a usage change here, and it is worth doing on the numbers
above: audit the drawer's Suspense boundaries so a suspending `lazy` cannot
discard `observer` siblings. The nesting is the problem — `App.tsx` wraps a lazy
`DrawerWidget`, whose widget `ReactComponent` is lazy again
(`HierarchicalTrackSelectorWidget/index.ts`), with further lazy dialogs below in
`HamburgerMenu.tsx` and `TrackCategory.tsx`. Each is a boundary that can throw
away a pass containing observers.

Not established, and worth measuring rather than assuming: *which* of those
actually suspends at the moment the 14 reactions appear. The count is taken at
steady state after load, with no dialog open, so it is not the dialogs. Find the
suspending sibling first, then move that one boundary and re-measure with the
observer count rather than by eye.

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

**The software-rasterizer half is done as of 2026-08-12, and it shrinks what is
left here.** Detection landed first (`glRenderer` / `softwareWebgl` off the probe
context), then the routing: `createGpuHal` steps over the WebGL2 rung when the
rasterizer is software and nothing was pinned. Measured on one view with three
tracks and no churn — WebGL2 blocks the main thread 1.3-5.5 s in a single task,
Canvas2D never exceeds 0.34 s and never once exceeds 500 ms. Both the numbers and
the two things that must not break (the cross-backend gate, the figure corpus)
are in
[reference/GPU_CONTEXT_BUDGET.md](reference/GPU_CONTEXT_BUDGET.md).

**So re-measure the population before building the structural work.** The
remaining group is *hardware* GL with no WebGPU and 17+ tracks: a machine with
WebGPU builds no WebGL2 display context at all, and software ones now take
Canvas2D. Canvas2D is ~2x worse for that group, so it cannot simply be routed
too — and the analytics `software-rendering` bit says how much of the no-WebGPU
population has already been taken out of it. Ask that before spending on context
pooling or track-level mount/release.

### MAF fetch cost on long blocks

Design done, nothing built, premise unconfirmed — see
[reference/MAF_LARGE_BLOCKS.md](reference/MAF_LARGE_BLOCKS.md). Run the one-line block-size
check before building any of it. The byte-gate half is closed: the gate no longer
scales an estimate by span, it re-measures at the viewport it is judging, so a
cost quantized by feature is measured rather than modelled
(REGION_TOO_LARGE.md § "Measurement follows the viewport").

### Produce and host the HPRC summary tier

Both MAF adapters take a `summaryAdapter` slot now (`3e25ca40ce`) and the
producer is published (`maf2bed` v0.6.0 on crates.io). What is left is one
streaming pass over the **5.96 GB v2.0 TAF** — `taffy view` into
`maf2bed --summary`, not the 53 GB MAF — landing at roughly 75 MB bgzipped for
the whole genome, then an S3 write to the jbrowse.org bucket.

Nothing is broken without it: the tutorial reads the TAF, which draws at gene
scale within the default gate, so this buys whole-chromosome navigation. The
measurements not to re-derive are in
[reference/MAF_LARGE_BLOCKS.md](reference/MAF_LARGE_BLOCKS.md) §"A `.tai` is not
a tier" — ~19 compressed bytes/bp for the v2.1 MAF and ~2.1 for the v2.0 TAF,
flat from 100 kb up, so whole chr6 is 3.19 GB and 354 MB; the same 200 kb of chr6
is 4.35 MB as alignment and **3.5 kB as summary**, all 464 haplotypes present.
`~/scratch/jbrowse-pangenome` holds a real C4 slice and its summary, enough to
wire this against a real region offline
([reference/HPRC_RELEASE2.md](reference/HPRC_RELEASE2.md)).

### A TPA reader

HPRC ships 466 TPA files as a first-class alternative to the PAFs and nothing
reads the format. Of everything on the HPRC list this is the one integration
that would be genuinely differentiating rather than catching up.

### A byte-native MAF adapter path, once tabix-js publishes `lineBytesCallback`

`GMOD/tabix-js` PR #156 adds `lineBytesCallback` — the decompressed buffer and
the line's `[lineStart, lineEnd)` range instead of a decoded string. Open,
mergeable, green there; nothing in jbrowse can consume it until it is published.

**Size it honestly before spending the follow-up**, because the PR's own
description argues a different number than the one that matters here. The decode
it removes is part of a **7.3 ms** line walk, not the ~26 ms a pre-columnar
profile implied. The real win for MAF is downstream of the decode:
`MafWirePacker.write` already takes a `Uint8Array` as readily as a string, so a
byte-native path skips the decode *and* the `encodeInto` inside the 31 ms pack
stage. That is the number to measure when the publish lands.
[reference/MAF_WORKER_PIPELINE.md](reference/MAF_WORKER_PIPELINE.md) is the
profile it has to be measured against.

### Measure the dense-lane SNP change on a deep pileup

`57e26565a4` moved SNP segments into dense lanes and lives in
`packages/alignments-core`, so the alignments coverage pipeline inherits it — but
every measurement behind it is MAF data (78 → 27 ms). A deep pileup has a
different mismatch distribution, far more mismatches per position and far fewer
distinct positions, which is the shape where dense lanes win by the most. The
direction is safe and verified output-identical; the magnitude is unmeasured.

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
  entry on WebGPU). `PipelineDescriptor` and both HALs grow multi-buffer support;
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

#### `featureItemMap` is the same allocation, in the same file

Take it in the same pass; it was a separate entry until 2026-08-13 and each one
said to pair it with the other, which is the tell. `baseModel.ts`'s
`featureItemMap` allocates one entry object per feature AND per subfeature across
every visible region, on every layout change, pan or zoom. Its consumers ask very
little of it: `useHighlightOverlays` does a handful of `.get()`s (and genuinely
needs `entry.vr` / `entry.data`), while `useFloatingLabels` uses it only for
`?.kind === 'feature'` to decide whether a label is clickable.

That second consumer is removable outright. `emitSubfeatureLabel` always sets
`parentFeatureId` and `processFeatureRecord` never does, so
`clickable === (labelData.parentFeatureId === undefined)` with no map at all.

With it gone the map is built for roughly five lookups, so replace it with an
on-demand region scan or a lazily-populated per-id cache.

### The SV inspector rebuilds its chord track from the whole callset per filter

`featuresCircularTrackConfiguration` carries every visible feature inline, so a
changed filter means `hideTrack` + `addTrackConf` on a conf holding the callset.
`showTrackGeneric` then `structuredClone`s that conf and, because it is a plain
object rather than a state-tree node, runs `trackType.configSchema.create` on it
purely to produce a nice error message before throwing the result away and
creating it for real. The callset is therefore cloned once and validated twice,
per filter change.

Two independent fixes, cheapest first:

- skip the throwaway validate for a conf built internally rather than read from
  user config. Contained, but it lives in `util/tracks.ts` and every showTrack
  path in the app goes through it, so it wants its own tests.
- stop embedding the features at all: give ChordVariantDisplay an adapter that
  reads `visibleRows` off the spreadsheet model rather than a `FromConfigAdapter`
  snapshot, so a filter change becomes a re-render instead of a track teardown.
  Bigger, and it changes what the SV inspector persists.

Measure before building either. The K562 STAR-Fusion table is 44 rows and will
show nothing; use a callset in the thousands. Note that the redundant rebuilds
are already gone — `setVisibleRows` compares before writing (`sameVisibleRowFlags`
in `SpreadsheetModel.tsx`), so what is left is genuine filter changes only, and
that is what needs timing.

### Give the RPC workers one inflate pool and one byte cache between them

**Read the close condition before the design: this entry is more likely to end
in a measurement than in a build.** Three of the four reasons it was opened have
since been measured out or fixed upstream — the thread count (no arm beat the
status quo), the sizing worry (unsupported), and the resting memory (reaped
upstream in `@gmod/bgzf-filehandle` 6.6.0). What is left is the memory *peak*
while someone is actively browsing several tracks, and if that turns out not to
matter, **close this rather than building the channel**; the duplication is then
untidy and free.

**The multiplication is measured; what is open is the sizing.**
`browser-tests/percontext-probe.ts`, production build, 16 cores:

| tracks | RPC workers | bgzf pool workers | reference fetches |
| ------ | ----------- | ----------------- | ----------------- |
| 1      | 1           | 4                 | 1                 |
| 5      | 5           | 20                | 5                 |
| 8      | 5           | 20                | 5                 |

Eight tracks give five of each, so both scale with JS contexts rather than with
tracks: `sharedBgzfWorkerPool()` and `RemoteFileWithRangeCache`'s chunk map are
both per context, and adapters are sticky per track to one of
`clamp(hardwareConcurrency - 1, 1, 5)` workers. Twenty inflate workers each hold
a grow-only wasm heap and none is ever torn down; the same reference sequence is
downloaded once per worker for tracks sharing an assembly and a viewport.
[reference/BAM_STACK_INTEGRATION.md](reference/BAM_STACK_INTEGRATION.md) seam 1.

`@gmod/bgzf-filehandle` ships `BgzfWorkerPoolHost` / `BgzfWorkerPoolClient` /
`createPoolPort` for the pool half and names JBrowse's data workers as the case;
neither symbol appears in this repo. **Both halves want the same
`MessagePort`-at-boot channel through `makeWorker`, so build that once** and
carry the byte cache over it too rather than solving the pool alone.

**Do not take this on for the thread count — that premise is measured out.**
`pool-oversub-probe.ts` at 4 cores under `taskset`, where the multiplication is
worst (3 RPC x 4 = 12 inflate workers, ~4x oversubscribed): no arm beat the
status quo, and cutting the inflate workers to 3 was slower in every batch.
Per-chunk parallelism is worth more than avoiding oversubscription. Two builds
of identical code differed by 15%, wider than any gap between arms, so nothing
finer than "no win here" can be read off it.

The sizing worry that used to be written here — that one shared pool of four
would regress the several-tracks case — is not supported either: the "capped to
1 per context" arm is strictly worse than that and cost ~13%, inside the drift.

**What is left is the memory PEAK, and only that.** The resting level is
handled upstream as of `@gmod/bgzf-filehandle` 6.6.0: a pool reaps its own
workers after 3 minutes idle and respawns them on demand, so the 20 grow-only
`WebAssembly.Memory` instances no longer outlive the tracks that needed them.
What sharing would additionally buy is a lower peak *while someone is actively
browsing several tracks*, and that is unmeasured. Note the usual tools do not
see it — wasm memory is outside `Runtime.getHeapUsage`, so this wants
process-level RSS per target rather than a heap snapshot. If the peak turns out
not to matter either, close this entry rather than building the channel; the
duplication is then untidy and free.

Do **not** touch `SharedBudget` (ADR-064) while doing this. Per context is the
right scope for it — a worker OOMs on its own heap — and only threads and the
network are being bounded from the wrong place.

Both halves of the reclamation pair are now done, so don't re-open either. The
cache sweeps itself on an interval that starts with the first chunk and stops
when the sweep empties the cache (`RemoteFileWithRangeCache.ts`); the exported
`sweepIdleCache` is a documented extra for a caller with its own schedule, not a
dangling hook. And the pool's fix could NOT have been "call
`destroySharedWorkerPool` when the last bgzip track closes", which is the obvious
shape and a footgun: a destroyed pool throws out of `decompressBlocks`, and
`BamFile` holds the pool promise for the life of the track, so that would break
open readers rather than reclaim anything. It had to be reaping inside the pool.

Node cannot measure any of it — `getSharedWorkerPool` returns `undefined` there,
so every vitest bench in all three repos reports parity forever. Use
`percontext-probe.ts` and heed the traps in its header and in
[reference/BGZF_WORKER_POOL.md](reference/BGZF_WORKER_POOL.md).

For the byte-cache half, build the fixture with `make-tiled-fixture.sh` first.
The stock one is a 255 KB reference that fits inside a single 256 KiB chunk, so
sharing the cache across workers looks free on it whatever the truth is — the
duplication is real (measured: one reference download per RPC worker) but its
COST is invisible until a pan can miss that cache.

