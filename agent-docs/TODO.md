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
building first would be guessing. Five are blocked on a visual call that is not
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
| [Repeat and CRISPR subpart labels draw into an unreserved row](#repeat-and-crispr-subpart-labels-draw-into-an-unreserved-row) | canvas | decide: reserve a row per glyph, or say `below` is a transcript/box affordance |
| [Let a dotplot click open the alignment it is on](#let-a-dotplot-click-open-the-alignment-it-is-on) | dotplot | the pick already answers; decide ship-ids vs resolve-on-demand first |
| [Import the recipes' remaining copied label tables](#import-the-recipes-remaining-copied-label-tables) | website, menus | check each registry's module for a React import; a leaf is importable today |
| [A validator gate for the examples sites' configs](#decide-whether-the-examples-sites-configs-get-a-validator-gate) | embedded, config | the file is fixed; what is open is the copy and where a gate lives |
| [The desktop autosave interval](#decide-the-desktop-autosave-interval-or-scale-it-with-the-session) | desktop | a call about unsaved work; the flush paths already narrowed the window |
| [Factory reset leaves the BLAT partition](#have-desktops-factory-reset-clear-the-blat-partition) | desktop, BLAT | two lines; `Partitions/jbrowse-blat` survives reset |
| [Whether the web export pins its deployment](#decide-whether-the-web-export-pins-the-deployment-it-opens) | desktop, export | a deployment decision; the link already records what made it |
| [A config slot for `bezierRadiusRatio`](#decide-whether-bezierradiusratio-becomes-a-config-slot) | circular view, config | decide whether the state-model property stays beside the slot |
| [A fixed tick pool for the coordinate ruler](#give-the-coordinate-ruler-a-genuinely-fixed-tick-pool) | LGV, perf | the key half landed; what is left is the count delta |
| [Get the synteny shader source out of the eager set](#get-the-synteny-shader-source-out-of-the-eager-set) | synteny, bundle | 121 KB attributed; the seam is the renderer factory, not the codegen |
| [Canvas2D fades a curved sub-pixel ribbon by one number](#canvas2d-fades-a-curved-sub-pixel-ribbon-by-one-number) | synteny, canvas2d | most of the measured drift was the fill-vs-stroke branch and is fixed; 0.31pp of fade left, at N strokes in the 500k-instance loop |
| [Move the four cubic AA ramps onto the linear one](#move-the-four-cubic-aa-ramps-onto-the-linear-one) | shaders, GPU | the measurement is done; convert the dotplot capsule and read the cross-backend gate's drift, which should fall |
| [Extra large text SVG mode](#extra-large-text-svg-mode-for-pub-ready-figures) | SVG export | thread a scale the way `fontFamily` threads |
| [Alignments / canvas odds and ends](#alignments--canvas) | alignments, canvas | seven independent small items |
| [Group the methylation path's CIGAR walk](#group-the-methylation-paths-cigar-walk-the-way-the-marks-path-now-is) | alignments, perf | decide whether the exported callback's order is a contract |
| [The bezier overlay draws a junction it never fetched](#the-bezier-overlay-draws-a-junction-across-segments-it-never-fetched) | alignments | feed it `unpairedReadChain` and dash the spanning arc; copy the split view, not the arc band |
| [Verify the overlay palettes in dark mode](#verify-the-overlay-palettes-in-dark-mode) | alignments | open a pileup with arcs, dark theme, look |
| [Give colorNeutralRead a dark variant](#give-colorneutralread-a-dark-variant-or-fold-it-into-colorpairlr) | alignments, palette | decide two neutrals or one before editing either |
| [Re-film the protein launch tour](#re-film-the-protein-launch-tour-once-protein3d-ships-the-a3m-removal) | figures, protein3d | waits on a protein3d release; the a3m is gone for good |
| [What colour is an arc with no pair orientation](#what-colour-is-an-arc-with-no-pair-orientation) | alignments | a visual call, then one of two edits |
| [Midnight primary is invisible on dark stock](#midnight-primary-is-invisible-on-the-dark-stock-ground) | palette, theme | pick one of three; never re-tint a single component |
| [The interbase stack overruns its half-band](#the-interbase-stack-overruns-its-half-band-at-a-split-read-breakpoint) | alignments | a visual call; the overflow is measured, no fix is chosen |
| [Make the capture scroll-invariant](#make-the-snapshot-capture-scroll-invariant-then-widen-the-gate-to-webgpu) | browser tests | it is `snapshot.ts`, not a shader — attribution is done |
| [Attribute the TIMEOUT mode](#attribute-the-browser-test-timeout-failure-mode) | browser tests | report the display's state, don't extend the wait |
| [Make the webgl blank verdict readable](#make-the-webgl-blank-verdict-readable) | browser tests | one diagnostic run; never leave it on |
| [Overlay labels cover the row below](#overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes) | canvas | decide: reserve a row, or call overlay normal-mode only |
| [Shoot the multihop chain as counted arcs](#shoot-the-multihop-chain-as-counted-arcs-in-one-lgv) | figures, alignments | take the partner windows from the nanomonsv VCF, not the picture |
| [Render the converted callout specs](#render-the-twenty-specs-whose-callouts-were-converted-to-anchors) | figures | sweep them; five move deliberately |
| [Re-render the ortholog-table figures](#re-render-the-ortholog-table-figures-after-the-blocks-dedupe) | figures, synteny | five specs; raise alpha only uniformly, if at all |
| [Contract checks are stripped in production](#the-display-contract-checks-are-stripped-in-production) | limits, plugins | the in-tree half is gated; decide the out-of-tree channel |
| [Delete or implement the RPC `timeout` option](#delete-or-implement-the-rpc-timeout-option) | RPC | delete half done; the implement half goes in `RpcHandles` |
| [Brand the out-of-request refNames](#brand-the-out-of-request-refnames) | synteny, RPC | type-only; brand BOTH ends or the compare still passes |
| [Give `session.jbrowse` a real type](#give-sessionjbrowse-a-real-type) | core types, MST | pick one interface or two BEFORE touching any of the 36 sites |
| [The swapped track resolves to a point](#the-swapped-assembly-track-resolves-to-a-point) | synteny | the hang is fixed; what is left is the swap, still not isolated |
| [Comparative cancel and retry](#give-the-comparative-displays-a-cancel-and-a-retry) | synteny, dotplot | read ADR-054 first; retry is a button, never automatic |
| [Verify the shared rect buffer headed](#verify-the-shared-rectcontinuation-buffer-on-real-hardware) | GPU canvas | code landed; only the headed WebGL2/WebGPU check is owed |
| [Feet on the interchromosomal ticks](#give-the-interchromosomal-ticks-breakend-feet-too) | alignments | decide what a coalesced tick's direction is, then the shader |
| [Bound a breakend foot by its region](#bound-a-breakend-foot-by-its-displayed-region) | alignments | bound it by the REGION; the partner bound is wrong and was reverted |
| [One mark per interchromosomal cluster](#draw-one-mark-per-interchromosomal-cluster) | alignments | a figure-changing decision; pick the position rule first |
| [Bound a cluster's diameter](#bound-an-interchromosomal-clusters-diameter) | alignments | measure at depth before changing what the floor means |
| [The read cloud's axis follows one outlier](#the-read-clouds-y-axis-autoscales-to-a-single-outlier) | alignments | needs a measurement on deep data, not a chosen statistic |
| [Linearize the pangenome](#linearize-the-pangenome-draw-graph-variation-as-alignment-style-glyphs) | pangenome | read PANGENOME_GRAPHS.md — four findings constrain the layout |
| [Pangenome graph view queue](#pangenome-graph-view-the-open-queue) | pangenome | three items unblock the rest; take the LGV axis first |
| [Collapse trivial bubbles in a file-loaded graph](#coarsen-a-graph-loaded-as-a-file-collapse-trivial-bubbles) | pangenome | designed; path lanes are the open question |
| [PanSN prefixes in the add-track form](#offer-a-files-pansn-prefixes-in-the-all-vs-all-add-track-form) | comparative | the error half shipped; this is the discovery half |
| [Synteny clicked outline in tiled mode](#the-synteny-clicked-outline-strokes-every-match-tile-in-transparent-indel-mode) | synteny | get the visual call — hull silhouette or per-tile |
| [Observer reactions leak from discarded renders](#destroying-an-mst-tree-that-something-still-observes) | app-core, drawer | give each lazy its own Suspense boundary; verified 2 leaked -> 0 |
| [Cut WebGL2 contexts per display](#cut-webgl2-contexts-per-display) | GPU, limits | build — ceiling measured at 16, one ordinary view crosses it |
| [Produce and host the HPRC summary tier](#produce-and-host-the-hprc-summary-tier) | MAF, pangenome | built and hosted; report the overlap collapse upstream, then decide span vs cost |
| [Take the MSAA target's size on a retina display](#take-the-msaa-targets-size-on-a-retina-display) | GPU, limits | run the probe at dpr 2; the 640 MiB is arithmetic, not measurement |
| [Does a sixth track want a sixth RPC worker](#does-a-sixth-alignments-track-want-a-sixth-rpc-worker) | RPC, limits | one `workerCount` line to try; the answer is a memory measurement, not a stopwatch |
| [Cross-region arc count at 300x](#read-the-cross-region-arc-count-at-300x-which-the-arc-cap-is-sized-from) | alignments, arcs | one `crossRegion.length` read; the cap's input is an estimate |
| [Dense-lane SNP change on a deep pileup](#measure-the-dense-lane-snp-change-on-a-deep-pileup) | alignments | direction safe, magnitude unmeasured |
| [Does a quality floor still buy anything on the band](#does-a-base-quality-floor-still-buy-anything-on-the-coverage-band) | alignments | measure the sub-Q20 share that SURVIVES the frequency floor |
| [Walk the CIGAR once per MM tag](#walk-the-cigar-once-for-a-reads-whole-mm-tag-not-once-per-group) | alignments, perf | the same-base half shipped; what is left is worth ~1.1x and is Fiber-seq only |
| [Alignments main-thread repack](#alignments-still-repacks-every-row-instanced-pass-on-the-main-thread) | alignments, GPU | profile the pack/upload/clone split first |
| [Stop rewriting the worker's arrays](#stop-rewriting-the-workers-arrays-to-lay-out-features) | canvas | count the consumers — they decide if it is worth it |
| [The SV inspector rebuilds its chord track per filter](#the-sv-inspector-rebuilds-its-chord-track-from-the-whole-callset-per-filter) | SV inspector | time it on a callset in the thousands, not the 44-row table |
| [One inflate pool and byte cache per session](#give-the-rpc-workers-one-inflate-pool-and-one-byte-cache-between-them) | bgzf, RPC, limits | the speed premise is measured out; weigh the wasm memory, or close it |
| [The comparative displays sit behind neither bring-your-own seam](#the-comparative-displays-sit-behind-neither-bring-your-own-seam) | synteny, dotplot, embedded | fetch status done; tooltip and context menu left, and they need shapes of their own |
| [Sweep the unused exports, or close the question](#sweep-the-unused-exports-with-a-real-tool-or-close-the-question) | tooling, CI | configure knip per package; a grep returns 623 names and almost none are dead |
| [charactersPerRow is a constant on a model](#charactersperrow-is-a-constant-living-on-a-model) | feature details | decide setting vs const; a setter with no UI is the worst option |
| [Download plaintext writes an unreadable FASTA](#download-plaintext-writes-a-fasta-no-tool-can-read) | feature details | a product call, and it moves "Copy plaintext" too |
| [The config-read baseline's remaining 125](#the-config-read-baselines-remaining-125-is-mostly-not-display-debt) | config, types | 72 of them are track/assembly reads; confirm that before estimating any of it |
| [Time a two-tier PIF to settled](#time-a-two-tier-pif-to-settled-in-a-browser) | synteny, PIF | bytes are measured; what is left wants the app and the ready gate |

## Ready to build: small and self-contained

### Repeat and CRISPR subpart labels draw into an unreserved row

`SELF_LABELING_GLYPHS` (`plugins/canvas/src/RenderFeatureDataRPC/labelUtils.ts`)
marks `RepeatRegion` and `CrisprGuide` as labelling their children rather than
themselves, on the stated grounds that those rows are counted by each child
layout's own `labelRows`. That holds for `MatureProteinRegion`
(`layoutMatureProteinRegion` sets `ownsLabelRow` per child) and for neither of
these two: `layoutRepeatRegion` is a bare `layoutContainerGlyph` and
`layoutCrisprGuide` a bare `layoutChild`, and both emitters register their
children straight off the feature in `glyphEmitters.ts` — the repeat's subparts
at `:459`, the PAM at `:568`.

So with **Subfeature labels → Below** on either track type, `emitSubfeatureLabel`
draws text into a row `bodyHeightPx` never reserved. On a CRISPR guide the
feature's own name lands at `featureBottom + 2` and "PAM" at `featureBottom + 0`,
two 11px labels 2px apart, and the pair overhangs into the next feature's row.
On a `repeat_region` every subpart shares one row by design, so all N subpart
labels sit at the same y — fine where the subparts are side by side (the LTRs and
TSDs), overlapping where they are not (the internal retrotransposon spans them).

**First move: decide whether these two glyphs reserve or opt out.** Reserving is
one line each — set `labelRows: 1` on the layout when `config.subfeatureLabels
=== 'below'` and the glyph will register a labelled child — and it is what the
transcript path already does. Opting out means saying `below` is a
transcript/box affordance and having these two draw `overlay` regardless, which
is cheaper but silently overrides a setting the user chose. The default is
`none`, so nothing ships broken today.

### Let a dotplot click open the alignment it is on

The dotplot resolves the alignment under the pointer already — `pickFeatureAt`
answers a `{displayKey, featureIdx, segmentIdx}` hit, the tooltip names it, the
hover restrokes it — but a click does nothing with it. Synteny opens
`SyntenyFeatureWidget` from the same pick, so the asymmetry is the dotplot's, not
the widget's.

What is missing is only the payload: the widget wants a `uniqueId`, and the
dotplot fetch ships no `featureIds`. Two ways, and the cheap one is not obviously
right:

- **Ship them**, as synteny does. Measured cost of one `string[]` at 500k
  features is ~44ms of structured clone per fetch (`makeStringDict` in
  synteny-core carries the measurement), and a dictionary does not help because
  ids are distinct by definition. That is a real cost on every whole-genome fetch
  to serve at most one click.
- **Fetch the one id on demand**, from the hit's feature index, the way
  `SyntenyResolveMatchingRegion` returns an answer rather than a feature. Free on
  the fetch path, one round trip on the click, and it needs a new RPC method.

The second is the better shape and the reason this is not already done: it wants
the method designed rather than a lane added. Note the local coordinates the widget
takes are derivable without either — `dotplotTooltip.ts` already resolves both
axes' spans off the view's regions, and canonically, which is what that panel
should show.

Worth doing with it: the pointer handler currently clears a selection on any
click (`useDotplotInteraction`'s `onPointerUp`), so the new behaviour has to
distinguish "clicked an alignment" from "clicked empty plot to cancel", which the
hit already answers.

### Group the methylation path's CIGAR walk, the way the marks path now is

`getModPositions` shares one positions array across the types of an MM group, and
`forEachMaxProbMod` groups the entries holding it by identity so a `C+mh` read
walks the CIGAR once instead of once per type. **`forEachModRefPos` is the third
walk and still per entry** — same duplication, one layer over in the
fill-unmarked methylation path (it is what `getMethBins` drives). A CIGAR walk is
O(read length), so on a 50 kb read a combined code pays ~50k iterations twice for
offsets the first pass already visited.

Two things make this not a copy of the fix that landed:

- **The callback order changes**, from "all of type m, then all of type h" to
  "both types at each position, ascending". `getMethBins` is order-independent —
  it writes `methBins[ref]` and `hydroxyMethBins[ref]`, disjoint arrays keyed on
  position — but `forEachModRefPos` is **exported from
  `@jbrowse/modifications-utils`**, so an external consumer accumulating
  sequentially per type would break. Decide whether that export is a contract
  before reordering it, or give the grouped walk its own entry point.
- **It is unmeasured.** `modCombinedCode.bench.ts` prices the marks path; nothing
  prices this one, and the mode is off by default (fill-unmarked). Extend that
  bench with a `getMethBins` arm rather than reasoning from the other number — the
  emit work per position is genuinely different here, since both channels are
  kept rather than only the winner.

### Decide whether the examples sites' configs get a validator gate

The react-app site's `volvox-config.json` is fixed — it was a copy forked before
the config migration, and its eight pre-slot spellings (`pileupDisplay`,
`renderers`, singular `renderer`, `get(feature,'x')` jexl, the
`showLabels`/`showDescriptions` pair) each loaded, appeared and silently did
nothing. Each block took the canonical config's own value for the same trackId;
`lollipop_track` went with it, following `fb1fd404b3`.

Two things did not get decided, and they are the entry:

- **Should it be a copy at all.** Nothing regenerates it from
  `test_data/volvox/config.json`, so it can fork again the same way, silently.
- **Where the check lives.** The lineargenomeview site's generator refuses to
  write an invalid config (`gen-nextstrain-demos.mjs`, `assertConfigValid`); this
  site has no generator. Doing every site at once means
  `runExamplesSiteChecks` (`@jbrowse/browser-test-utils`), which would put
  `@jbrowse/cli` in all four sites' installs for one function — weigh that
  against two fixtures.

Note the validator's two remaining errors on that file are **not** bugs to fix:
`wombat` is the deliberate `volvox_wrong_assembly` fixture and `volvox_del2` is
missing in the canonical config too, so both are inherited rather than drift. A
gate has to exempt them, which is its own small design question — and `vvx`
reports as a missing assembly when it is an assembly *alias*, which is a
validator gap rather than a config error.

### Decide the desktop autosave interval, or scale it with the session

`autorun`'s `delay` is a throttle rather than a debounce, so the 1 s autosave
fires for as long as anything keeps changing — panning included. The data-loss
window that number was chosen against is much smaller now: `closeGuard` flushes
on window close, and Exit, return-to-start-screen and session-swap all flush too.

The version worth proposing is an interval that scales with the serialized size,
so a large session stops paying a small one's cadence. It is a judgment call
about someone's unsaved work rather than an optimization, which is why it is
written down instead of changed.

### Have desktop's factory reset clear the BLAT partition

Reset prunes the userData directories but not `Partitions/jbrowse-blat`, so a
solved CAPTCHA's `cf_clearance` survives it. Two lines. It was judged out of
scope alongside the partition itself (`electron/blatSession.ts`); take it if
reset should mean reset.

### Decide whether the web export pins the deployment it opens

`DEFAULT_WEB_BASE_URL` is `.../jb2/latest/`, and the hosted base config a link
diffs against is fetched fresh on both ends, so an export made today opens
against whatever is deployed when someone follows it. The link records what
produced it — `exportedFrom=jbrowse-desktop@<version>` — which closes the
diagnosis half; what is open is whether it should also pin what it opens, and
that is a deployment decision rather than a code one.

### Decide whether `bezierRadiusRatio` becomes a config slot

`ChordVariantDisplay.bezierRadiusRatio` sets how deep a chord bows toward the
center of the circular view. It is an MST property of the display's state model
with a `0.1` default, and today nothing can set it: no action mutates it, no
track-menu item offers it, and a track config drops it because the display's
schema declares no such slot. Only a hand-edited session reaches it.

Two independent authors wrote it into an `#example` as though it were config —
both the `#config` and the `#stateModel` block carried the same wrong track
config until 2026-08-16, which is the evidence that the missing slot is the
surprise rather than the property.

What has to be decided, and why it isn't a one-line addition:

- **Whether the property stays.** Adding the slot beside it leaves two spellings
  of one setting, so the slot needs a `migratedDisplayKeys` entry the way
  `heightPreConfig` has one, or the property goes and every saved session
  carrying it silently loses the value.
- **Whether it wants a menu item too.** The comment in `validateConfig`'s
  `checkSessionDisplay` states the direction as "every track-menu setting is a
  config slot now"; this one is neither, so adding just the slot leaves it the
  only chord geometry with no UI.

### Give the coordinate ruler a genuinely fixed tick pool

The key half landed 2026-08-15: `ScalebarCoordinateLabels` keys its list
positionally, so a zoom repositions and relabels nodes instead of rebuilding
them, and the scalebar's structural churn over a 5× zoom went 535 → 248 against
a 1523 → 1369 total.

What is left is the label *count* moving between frames — positional keys pool
`min(oldCount, newCount)` and still mount or unmount the difference, and the
count shifts as label text changes width and `labelFitsInBlock` /
`MIN_TICK_LABELS_PER_BLOCK` drop a different number of them. A constant node
count with the extras hidden closes it, and is worth about that remainder.
Weigh it against the other two options before building:  a canvas ruler (bigger
win, loses selectable text), or coarsening ticks off `coarseBpPerPx` during the
zoom spring and snapping exact on settle.

[reference/INTERACTION_PERF.md](reference/INTERACTION_PERF.md) has both
measurements and the repro tool, including the trap that it serves
`products/jbrowse-web/build` and so needs a rebuild between arms.
### Canvas2D fades a curved sub-pixel ribbon by one number

A sub-pixel ribbon is drawn as a ~1px band whose alpha carries how much of a
pixel it really covers. The GPU measures that width per fragment from the local
perpendicular; Canvas2D measures it once per ribbon off the centerline chord
(`ribbonPerpWidth`). Identical in straight mode. On a bezier the tangent is
vertical at both ends and twice the chord slope at the middle, so a rearranged
block is at its *widest* perpendicular exactly where it meets the frame — and one
number per ribbon cannot say that. The GPU is the accurate side.

**Scoped to the ALPHA, since `ribbonMaxPerpWidth` split off — and most of what
was measured here was the other half.** The same one number used to decide
fill-vs-centerline-stroke, and through that pickability, which put a curved
ribbon several px wide at both ends on the stroke branch as a 1px hairline that
could not be clicked. That is fixed: the branch asks the widest the ribbon ever
gets, which on a bezier is an end and is foreshortened by nothing. What is left
here is the fade applied once the branch has settled on a stroke — ribbons
genuinely under a pixel everywhere.

Re-measured with `probe-synteny-backend-drift.ts`, one build either side of that
one line, everything else held:

| hs1/mm39 | curved | straight |
| --- | --- | --- |
| diagonalized, before | 1.59% | 0.58% |
| diagonalized, after | **0.57%** | 0.58% |
| not diagonalized, after | **0.78%** | 0.47% |
| grape/peach, after | 0.01% | 0.01% |

So the curve-mode excess was about 1.0pp of branch error and about 0.3pp of
fade, not 1.0pp of fade — the numbers this entry was opened on
(1.54% / 0.53%, and 1.72% / 0.44% steeper) were reading both at once. What
remains is the 0.31pp gap in the steepest arm; the diagonalized view no longer
distinguishes the two modes at all.

**Why it is parked rather than fixed:** closing it means replacing one
`ctx.stroke()` of the centerline with N segments at N alphas, in
`drawSyntenyTrack`'s per-instance loop — the loop `StyleCache` exists for,
because `rgba()` string construction alone cost >100ms at 500k instances. Paying
N× the stroke calls there to sharpen the fallback backend is the wrong trade
unless someone wants the SVG export to match too, which is the case that would
justify it: the export goes through the same `strokeCenterline`, and a figure is
looked at closely in a way a fallback render is not.

**First move if it is picked up:** decide it on the SVG export, not the canvas.
If the export is the reason, N is small (a figure has few visible ribbons after
culling) and the interactive loop can keep the single stroke.

### Get the synteny shader source out of the eager set

`GpuSyntenyRenderer.ts` is statically imported by `SyntenyRendererFactory`
(`LinearSyntenyDisplay/SyntenyRenderer.ts`), which `LevelSyntenyCanvas.tsx`
imports at module scope — so the four synteny shaders' WGSL/GLSL strings are
eager on any page with a comparative view. Measured with
`pnpm probe-eager-graph --page synteny --holds`: 121 KB raw across
`syntenyFillCurve` / `syntenyFillStraight` / `syntenyEdgeCurve` /
`syntenyEdgeStraight`, four of the six costliest first-party eager modules on
that page.

**Not a codegen item — the codegen already put the strings in their own
module** ([EAGER_BUNDLE.md](reference/EAGER_BUNDLE.md) §"A namespace import is
the unit"). The renderer itself is what is eager, and the factory is the seam: it
picks a GPU or Canvas2D backend, and only the GPU arm needs the shader source.
First move is to check whether the Canvas2D arm is eager for a reason before
making the GPU arm a dynamic import — a `lazy()` here has to answer to the render
autorun, not to React.

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
- Name the base in the coverage tooltip's `Ref` row. That row reports the count
  (depth minus the alts) and cannot say `Ref (G)`, because the reference base is
  not on the main thread: `executeRenderAlignmentData` fetches `regionSequence`
  only under bisulfite colouring and ships it to nobody. Shipping it per fetch
  to letter one tooltip row is the wrong trade, so the version worth costing is
  a one-base fetch on hover, next to the widget round trip the click already
  makes.

### The bezier overlay draws a junction across segments it never fetched

The bezier connector overlay never reads `readSuppAlignments` — grep it across
`features/linkedReads/`, `shared/readGroupConnections.ts` and
`components/pileupBezierArcs.ts` and there are no hits. So it groups the
*fetched* alignments by QNAME, sorts each read's segments by clip-at-start and
joins consecutive ones (`splitJunctions`). When the segments between two of them
were never fetched, it joins across the gap and marks nothing.

Measured, with a COLO829-chain-1-shaped fixture — one unpaired read, chr3 fwd →
chr10 → chr12 → chr3 rev, only the two chr3 segments fetched.
`enumerateBezierPairs` returns one pair and `computePileupBezierArcs` returns one
arc:

```
M 25359568 5 C … 25359111 17     label: "Split alignment (inverted)"
```

A solid inversion junction on chr3, indistinguishable from a real one, where the
read actually foldbacks through 382 bp on two other chromosomes.

The other two renderers of the same read already handle it, and neither draws
this. The arc band suppresses the join by construction — `unpairedChainArcs`
walks the SA-augmented chain, so the two are not adjacent and no junction is
emitted between them, under a comment naming exactly this ("suppresses a
misleading direct join across an off-screen segment"). The breakpoint split view
draws it dashed: `markHiddenSegments` fills `hiddenSegmentsBetween`,
`AlignmentConnections` sets `strokeDasharray='4 3'`, and the tooltip reads
`hidden N segments not in view: <locstrings>`.

**Copy the split view, not the arc band.** The overlay is a per-read mode where
the user is following one molecule, so deleting the connector loses the thread;
the arc band is an aggregate, where a wrong junction would be counted. Dash the
arc and name the hidden loci.

The seam is already there. `resolveReadGroup<E, T>` is generic over the per-mate
chainer precisely so the two paths can differ here, and says so — *"the bezier
path chains only the on-screen segments (`splitJunctions`), the arc path
additionally walks off-screen SA segments."* Feed it `unpairedReadChain` instead,
which the derivative-allele picker already calls, and the overlay learns which
junctions span a hidden segment. `arcTooltip` → `setMouseoverExtraInformation` in
`PileupBezierOverlay` is where the locstrings go.

No new geometry, no anchor decision and no new setting — the one-ended hops
(where the far end was never fetched at all) are a separate, additive question,
parked in [ideas/sa-hops-in-the-bezier-overlay.md](ideas/sa-hops-in-the-bezier-overlay.md).

Three things to watch:

- **`unpairedReadChain` needs a `CanonicalRefName`** and the bezier path does not
  thread one; `computePileupBezierArcsFromModel` has to pass it, the way
  `derivativePathCandidates` does.
- **One seam, two outputs.** The live overlay and the SVG export both go through
  `computePileupBezierArcsFromModel` (`components/pileupBezierArcs.ts`), so the
  dash lands in both — check `PileupBezierArcsSvg.tsx` renders `strokeDasharray`.
- **Cost.** This adds an SA parse per read group (`featurizeSA` over
  `readSuppAlignments`) that the arc path already pays and the overlay does not.
  `enumerateBezierPairs` is the memoized, scroll-invariant half, so it lands
  there rather than per frame — but measure it at depth.

To see it: the COLO829 tumour ONT track in the `cancer_sv` demo
(`https://jbrowse.org/demos/cancer_sv/config.json`). Chain 1 is a closed cycle
chr3 → chr10 (199 bp) → chr12 (183 bp) → chr3 and the two chr3 arms **overlap**,
so a chr3-only view fetches both and draws the false inversion.

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

The `arcColorsMatchReads` half of this entry is done: the rule moved out of the
model getter into `arcKeyFoldsIntoReadKey` (shared/legendUtils.ts) and
`shared/arcKeyFold.test.ts` pins both of its halves — the twin-scheme table,
where `orientation` and `pairOrientation` are the one pair spelled differently,
and the categories-in-hand check, which is what refuses to fold an SA-split
pileup's `splitInversion` onto reads that never paint it.

### Give colorNeutralRead a dark variant, or fold it into colorPairLR

`colorNeutralRead` #c8c8c8 has no dark override, and it reads **11.2** against
the dark theme's #121212 — brighter than `colorPairLR` #d3d3d3 was (12.5) before
`colorPairLRDark` #8a8a8a was added to stop it painting "glaring near-white
blocks". It is not a rare slot: `swatchPaletteKeys` backs `nonSplit` with it,
which is the majority of a pileup under the split-read scheme, plus
`mapqUnavailable` and the sashimi arcs of an unstranded RNA-seq library.

Someone has already hit this and fixed only their own path.
`LinearAlignmentsDisplay/readTagColors.ts` moved its untagged-read case off this
value and onto the themed `colorPairLR` — "being a fixed light grey it painted
untagged reads BRIGHTER than ordinary reads under the dark theme, where
colorPairLR darkens and colorNeutralRead does not". The general case is still
there.

**The reason this is a decision and not a patch** is that the two values are
dE **3.95** apart, so the palette carries two near-identical light neutrals
serving the same role in different schemes — this one for `noStrand` / `nonSplit`
/ `mapqUnavailable`, `colorPairLR` for `normalInsert` / `noTagValue` / `plain`.
Adding a dark variant makes two neutrals theme-correct; folding leaves one. The
second is the smaller palette and the bigger change, since the legend labels the
categories separately and a fold makes two swatch rows the same colour.

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

**Then re-measure `Alignments Track` and `Alignments Color Schemes` before
widening, not after.** Both block in `CI_GATE_SUITES` today and both hold only
because every gate script passes `--skip-webgpu`; under webgpu they go eight
pairs over threshold, and the cause is this same scroll artifact rather than a
rendering difference, so **do not answer it with a threshold override** — see
[reference/CROSS_BACKEND_GATE.md](reference/CROSS_BACKEND_GATE.md) §"Alignments
under webgpu". No script runs the gate with webgpu in it — `test:browser:gate`
and `test:browser:gate:ci` both pass `--skip-webgpu` — so drop the flag by hand
from `products/jbrowse-web`:
`node browser-tests/runner.ts --backend=all --swiftshader --gate-only`.

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

### Shoot the multihop chain as counted arcs in one LGV

`multihop_split_view` tells this story today as four panels built by "Reconstruct
derivative allele → draw as split", plus a script. The read-connection arcs give
a second, much shorter route to it: COLO829's `chr3:25,357,600-25,361,000` with
the chr12 and chr10 partner windows as further **displayed regions** of one LGV,
tumour track at `readConnections: 'arc'`, and each hop draws as one coalesced,
support-weighted arc across the region dividers. This belongs beside the existing
figure rather than replacing it — the reconstruction is the story there, and this
is what the raw evidence for it looks like.

ONT split junctions are exact, so they coalesce on `arcKey` with no jitter and
each arc's width is the support nanomonsv called on. That is the best case this
feature has, which is why it is worth shooting.

**The figure only works if the partner windows are right**, and they come from
the nanomonsv VCF / `sv_multihop.py derive` output rather than from reading the
picture — [reference/SV_MULTIHOP.md](reference/SV_MULTIHOP.md) has the chain and
what is established about it.

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

### Re-render the ortholog-table figures after the blocks dedupe

`MCScanBlocksAdapter` now draws a gene pair once however many rows name it, and
the five figures off a `.blocks` table were captured before that. They lose
ribbons where the table repeated one, which for the OrthoFinder sets is not
spread evenly: the wheat figure's tauschii/urartu band was 55% repeats against
3% on the donor-to-hexaploid bands beside it, and the grasses figure's
non-maize pairs were ~21% against ~10% on the maize ones. So the bands the
duplication is NOT about get lighter and the ones it is about barely move, which
is the point of the change.

`orthofinder_synteny/vertebrates`, `/grasses`, `/wheat`, and the two multiway
grape/peach/cacao ones off `grape.blocks` (its transitive peach/cacao pair is
~12.5% repeats; the two direct pairs have none).

**The three OrthoFinder ones want their `chrom.sizes` rebuilt first**, which is
cheap — one pass over each GFF3 and BED, no OrthoFinder run — and has to reach
`demos/orthofinder_*/` for the figures to see it. The script now picks the 30
sequences carrying the most genes rather than the longest 30, which is a
different 30 on most of these genomes: 14 of frog's 30 held no ortholog at all,
18 of urartu's and 12 of tauschii's, while nine real chicken microchromosomes
(16, 25, 30, 31, 35, 36, 38, 39 among them) had fallen off the length cut with
33 and 34 kept. The rows lose their dead tick labels and chicken gets its
chromosomes back. Urartu is the one that stays awkward whatever the rule: its
IGDB assembly spreads ~8.6% of its genes over thousands of contigs, so the
`loc: '1 2 3 4 5 6 7'` in `orthofinder_synteny/wheat_4a_urartu` is still doing
work.

The alpha values were tuned against the old density — 0.15 on wheat and grasses,
0.3 on vertebrates, 0.5 on the two 4A figures. **Raise them only uniformly and
only if the whole band reads too faint**, since the thing that just went away was
a per-band bias and putting ink back per band would restore it.

### The display-contract checks are stripped in production

In-tree they are gated now: `config/jest/console.js` buffers the
`[jbrowse display contract]` prefix and `config/jest/displayContractGate.js`
fails the test that collected one (ARCHITECTURAL_LIMITS.md §"Ordering is the
contract"). Out of tree, nothing catches anything —
`process.env.NODE_ENV === 'production'` no-ops all five, so a plugin author
whose display declares `rpcProps` in `.actions()` gets the silent stale cache
and no message, ever. That is the population least able to diagnose it, and the
one nobody can write a test for.

Whether it is worth a session flag is the whole item, and the question is
*channel*, not cost — the checks are a `getMembers` call per display at attach.
A `console.error` surviving into a production build reaches nobody either; the
version worth building is one a plugin author would see, which means a session
notification behind a developer flag rather than an unstripped `console.error`.

### Delete or implement the RPC `timeout` option

**The delete half is done, and the position it rode in is gone too.**
`loadRefNameMap`'s `{ timeout: 1000000 }` went first, as an option nothing read:
the old `BaseRpcDriver.transport` spread an `options` bag into `worker.call`,
which destructured `statusCallback` and nothing else, so there was no timeout
mechanism anywhere in `packages/core/src/rpc/`. That bag has since been removed
outright — the handles ride `args`, one position each — so there is no longer
even a place to pass an inert option. The entry earned a
line because the option sat next to a carefully argued comment about
deliberately *not* passing a stop token, which made the surrounding code read as
though a bound existed.

What is left is the implement half, and it is now the sharper of the two:
`RemoteFileWithRangeCache` has a per-request deadline
(`@gmod/range-cache-filehandle`'s `RESPONSE_TIMEOUT_MS`) and the RPC layer has
none, so the same question is answered two ways at two
layers. Copy the shape rather than inventing one — it bounds the wait for a
*response*, not the transfer, and composes with the caller's signal instead of
replacing it.

**It goes in `RpcHandles`, beside the stop token, not in any registry entry.** A
timeout is a property of the call — every method can be bounded — which is the
same test `stopToken` and `statusCallback` each failed on their first attempt,
each by landing in one method's `args` and thereby being unpassable to the other
forty. `EntriesDeclaringCallLevelFields` in `RpcRegistry.ts` now fails
compilation naming the entry that tries it, so the wrong version of this is a
build error rather than a third repetition.

### The comparative displays sit behind neither bring-your-own seam

**`ComparativeFetchStatus` is done — the remaining two are the tooltip and the
context menu.** `ComparativeTooltip` and `SyntenyContextMenu` are mounted by the
two comparative render areas and reach `@jbrowse/core/ui` directly, so an
embedder who mounted `DisplayUIProvider` to keep Material off the page still
gets it from a synteny or dotplot hover or right-click.

The fetch status now goes through the seam, and the design question this entry
posed turned out not to be one. Its two states *are* `DisplayChromeOverlays`
entries — `Loading` and `BackgroundProgress` — and `ComparativeStatusModel`
already satisfies both of their model shapes structurally, both being
`{statusMessage?, statusProgress?}`. So it needed no new contract and no second
one: `synteny-core` depends on `@jbrowse/display-ui`, reads
`useChromeOverlayOverride()`, and falls back to a Material pair it binds itself
(a package cannot depend on `plugin-linear-genome-view`'s bindings).
`ComparativeFetchStatus.test.tsx` pins both directions.

**Check the shapes before designing a contract for the other two.** The tooltip
and the context menu genuinely are their own shapes, so they want entries of
their own or a second small contract in the same package — but the fetch status
looked like that too until someone compared the interfaces.

**One piece of this is fixed and the rest is latent, which is the trap.** The
loading bar was the only one that rendered without the user doing anything, and
`StatusProgressBar` is now toolkit-free, so the hole that was measured is closed
on the axis it was measured on: the BYO site's `synteny` page reports 0 Material
elements at rest **and** 0 during its first load. Everything else on that path is
Material and simply has not been reached yet — the tooltip wants a hover, the
context menu a right-click, and `LoadingOverlay`'s cancel and retry are
`IconButton`s that only appear when a caller passes the handlers.

**The bundle is a separate question and the answer there is still no.** That same
page has 105 eager modules importing `@mui/material`, 42 of them first-party, and
ships 691 KB gzip; `ComparativeFetchStatus` reaches them through the
`@jbrowse/core/ui` barrel, which `menuItems.purity.test.ts` asserts reaches
Material as its negative control. A rendered-element census cannot see any of it
— see "0 Material elements and no Material UI are different claims" in
EAGER_BUNDLE.md, whose holder table is the real scope. So this entry buys an
embedder the look, not the bytes, and nothing here changes that on its own.

**So take this together with
[Comparative cancel and retry](#give-the-comparative-displays-a-cancel-and-a-retry).**
That entry adds exactly those handlers, which is the commit that would put a
Material `IconButton` back on the page — and it would land green, because
nothing measures it.

**The layering objection is gone.** This entry used to weigh three options
because `DisplayChromeOverlays` and its provider lived in
`plugins/linear-genome-view` while `synteny-core` depends on `@jbrowse/core`
alone, so the component could not read that context. The contract is
`@jbrowse/display-ui` now — a package, with no UI-toolkit dependency and no
plugin above it — so `synteny-core` depends on it like anything else, and the
prop types it names are the four structural model shapes that moved with it
rather than LGV display models.

**The loading-time census is wired in, so this list is no longer invisible.**
`recordMuiFromLoad` in the BYO site's `smoke.mjs` samples from before each page's
own scripts run and holds the union to `MUI_BUDGET`, which is how the progress
bar was found in the first place. It catches an element that *renders*, so it
covers the cancel and retry buttons the moment a caller passes those handlers,
and — since `muiRaisedByHover` reads that same union again once
`censusWhileHovering` is done — a tooltip too, as far as a headless hover lands
on a feature. The context menu is what is left: it needs a right-click nothing
on that page drives.

### charactersPerRow is a constant living on a model

`SequenceFeatureDetailsF` declares `charactersPerRow: 100` as a `#volatile`
alongside four settings that each have an action and a localStorage round-trip.
This one has neither a setter nor any writer in the tree, so it is a constant
that pays the cost of looking like a setting: every reader goes through the
model, and the doc tables list it next to preferences a user can actually
change.

Two ways out, and they are not equivalent. Giving it an action and a localStorage
key makes it the "wider rows" setting the panel visibly lacks — the row width is
the one thing a user reading a long CDS wants to change, and the settings dialog
it would join already exists. Exporting it as a const from `consts.ts` instead is
the honest description of what it is today, and drops a member from a documented
model, so it wants `pnpm gendocs` and a check of
[reference/PLUGIN_ABI_STABILITY.md](reference/PLUGIN_ABI_STABILITY.md) — a
removal on a model surface is the direction that fails quietly.

Do not do both halfway. A setter with no UI is the worst of the three.

### "Download plaintext" writes a FASTA no tool can read

`getSequencePlaintext` takes the rendered panel's `textContent` after dropping
`[data-no-plaintext]` nodes, which strips the legend. It does not strip the
coordinate labels, because those are ordinary text in the sequence rows. With
"Show coordinates" on — a sticky preference, so it persists across sessions —
`sequence.txt` comes out as a `>`-prefixed FASTA header followed by rows each
carrying their own position number. Nothing downstream parses that, and the file
extension and the header both promise it does.

The mechanism is already there: mark the label spans `data-no-plaintext` and the
existing strip handles them. What is not decided is whether it should. Someone
pasting into a text editor to read positions alongside bases may want exactly
what it writes today, and "Copy plaintext" shares the same helper, so a change
moves both. The split worth considering is that download implies a file for a
tool while copy implies a human, which argues for stripping in the download path
only — but that makes two behaviors out of one helper, so it needs a deliberate
yes rather than a drive-by.

### Brand the out-of-request refNames

Read [reference/REFNAME_NAMESPACES.md](reference/REFNAME_NAMESPACES.md) first —
it holds the rule, the six plugins that hit it, and the six different answers
they each invented. This entry is what is left after synteny's.

`type AdapterRefName = string & { readonly __ns: 'adapter' }`, on the
**out-of-request** names only — mate, partner, target — not on refName
generally. Compile-time only: the property never exists, values stay plain
strings, nothing changes over the wire. The reference doc has the error codes,
verified against TS7 `--strict` rather than derived: TS2367 comparing two
brands, TS2345 into a `Map<Canonical,_>.get`, TS7053 into a
`Record<Canonical,_>[…]` — which are the three shapes the broken sites took.

**The trap, and it is the whole difficulty:** `plain === branded` does **not**
error, because `string` and `string & {…}` overlap. Branding one end buys
nothing. It also cannot catch a site that hands the name to a core function
taking a plain `string` — `positionViewOnSpan` → `bpToOffset` is the known one,
so this is a narrowing rather than a proof.

Now is the cheap moment, and that ordering is the point: branding a tree whose
comparisons already agree is a type-only change, where branding a broken one
buys an error list to wade through.

### Give `session.jbrowse` a real type

`session.jbrowse` and `root.jbrowse` are **`any`** in every product, so every
`.tracks`, `.assemblies`, `.addTrackConf(...)` off them is unchecked — a typo or
a wrong argument compiles. `AbstractSessionModel` and `AbstractRootModel` both
declare it `IAnyStateTreeNode`, which is `any`, so narrowing to the abstract
contract does not help either. 144 read sites over 77 files; annotating the
getter `unknown` surfaces **36** that do something with it, across app-core,
product-core and plugins. That 36 is the real size of the job.

**Do not reach for a generic — it is measured and it does not work.**
`BaseRootModelFactory` takes `jbrowseModelType: IAnyType`, and making it
`<JB extends IAnyModelType>` looks like the principled fix. It leaves
`root.jbrowse` exactly as `any`: every product composes the factory's result,
and `types.compose`'s overloads are declared over `IModelType<P, O, FC, FS>`, so
a model arriving as a naked type parameter has nothing to infer those four from
and the result degrades. Same limitation as the embedded session factory in
[reference/REJECTED_IDEAS.md](reference/REJECTED_IDEAS.md#config-and-mst) —
twice now, on unrelated models, which is what makes it a property of `compose`
rather than of either attempt.

So it has to be a hand-written structural interface, the way `Widget` already
serves `visibleWidget`. What it must cover, counted off the call sites: `tracks`
(24), `assemblies` (13), `plugins` (10), `connections` (9), `configuration` (5),
`defaultSession`, and the editing actions `updateTrackConf` (8),
`addTrackConf`/`addConnectionConf`/`addAssemblyConf`/`removePlugin` (3 each),
`removeAssemblyConf`/`deleteTrackConf`/`deleteConnectionConf`.

**The open decision, and the only hard part: the two config models genuinely
differ.** app-core's `JBrowseModelF` (web/desktop/react-app) has `assemblies`
and all the editing actions; product-core's `createConfigModel` (the embedded
products) has `assembly` **singular** and none of the actions. One interface with
the actions optional makes ~20 mutator call sites guard for something that is
always there in the products that call them. Two interfaces — a read surface both
satisfy, plus an editing surface only the app one does — is the better shape but
needs each of the 36 sites sorted into which it wants. Pick before starting; the
first spelling is not the one to discover at site 20.

Pin the result with `AssertNotAny<IsAny<...>>` when it lands, the way the
embedded products' `session`/`session.view` already are.

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

**The retry half already landed** — `SyntenyFetchStateMixin` owns
`reloadCounter` + `reload()`, `installComparativeFetchAutorun` reads it
unconditionally at the top of the autorun, and both error banners reach it:
dotplot's per-display one in `DisplayStatusOverlays.tsx`, and synteny's combined
one in `LevelSyntenyCanvas.tsx`, which reloads every errored display on the
level. What is left is the cancel:

- `fetchCanceled` volatile + `cancelFetch` action on `SyntenyFetchStateMixin`
  (`@jbrowse/synteny-core`), alongside the `fetching` / `loadedFetchKey` /
  `assembliesSwapped` / `reloadCounter` it already owns.
- `installComparativeFetchAutorun` skips the run while `fetchCanceled` — read it
  beside `void self.reloadCounter`, under the unconditional-read rule from
  `installGlobalFetchAutorun`, or reload dies the moment the gate goes false.
- One render site, not two: both views draw their loading state through
  `ComparativeFetchStatus` (`@jbrowse/synteny-core`), and the contract is
  already wide enough — `DisplayLoadingOverlayModel` declares `fetchCanceled`,
  `cancelFetchByUser` and `reload`, all optional, and `LoadingOverlay` renders
  the buttons off them. Two edits: widen `ComparativeStatusModel` to declare
  them, and forward them in the `muiStatus.Loading` binding, which passes only
  `statusMessage`/`statusProgress` today. A host's own overlay set gets them
  for free, since it reads the same model.

**The loop to not write.** `prepare` must never read `self.error`. The skeleton
already `setError(undefined)`s at the start of every fetch and `setError(e)`s on
failure, so an `error` read in the tracked half turns a single failure into an
unbounded retry loop — fetch, fail, error changes, autorun refires — paced only
by the debounce, against the server that just failed. Nothing catches this today
because `prepare` happens not to read it; the same hazard is why
`installGlobalFetchAutorun` documents that `rpcProps()` must never return
fetch-derived state.

### Verify the shared rect/continuation buffer on real hardware

The second per-region pack and upload is gone: `strand` moved into
`RectInstance` (`rectInstance.slang`, imported by both shaders) and continuation
draws off rect's buffer via `drawPass(continuation, region, bufferPassId=rect)`,
the arrangement chevron already had over line's. Per-rect GPU bytes for the pair
went 48 → 28.

What is still owed is the headed check, on a real GPU, against **both** backends
— a wrong attribute offset shows up as garbled geometry, and no unit test on the
Canvas2D path can see it. WebGL2 binds attributes through
`vertexAttribPointer`/`vertexAttribIPointer` (int vs float matters) while WebGPU
goes through `vertex.buffers`, so agreeing on one proves nothing about the other.
Zoom a gene past both viewport edges and read the »/« direction against the
strand arrows on the same glyph.

`sharedInstanceBuffers.test.ts` pins the two structs against each other, which is
what makes a silent drift into a test failure; it cannot tell you the HAL wired
the offsets it was handed.

### Give the interchromosomal ticks breakend feet too

An interchromosomal arc draws a foot at each end — a short horizontal tick lying
over the sequence that end keeps, so outward reads as a deletion-type junction,
inward as a duplication-type and parallel as an inversion
(`features/arcs/mark.ts`, `arcPath.ts`, and the section in
`LinearAlignmentsDisplay/CLAUDE.md`). An interchromosomal connection whose
partner is **off screen** draws as a pair of TICKS instead, and those have no
feet.

That is unfinished, not declined. A tick means "the partner is somewhere you
cannot see", and the direction at the near foot is exactly as informative there
— arguably more, since there is no second endpoint to read the orientation off.

It was left out because the two draws are not the same kind of thing. The feet
live in the SVG cross-region overlay, which re-traces `arc.mark` in TypeScript;
`arcLine` is a GPU/Canvas2D pass. So this one needs a per-instance direction
attribute, geometry in `arcLine.slang` plus `pnpm gen:shaders`, the Canvas2D
mirror, the SVG export, and a decision about whether a foot is part of the
tick's hit-test target. Roughly a day. Nothing in the landed arc work blocks it.

The direction itself is already computed and already correct for this case:
`readTrailingBodyDir` is a property of the junction rather than of the read, so a
tick coalescing several reads on one coordinate has one answer — but note that a
`ComputedLine` deliberately carries none today, and two junctions sharing a
breakpoint would otherwise take whichever read arrived first. Decide that before
packing a direction into the tick buffer.

Whichever direction a tick's foot ends up taking, it is the OFF-SCREEN-partner
case, so `pairOuterDir`'s distinction applies to it too: the mate-link producers
answer with the read's direction negated, because their endpoint is the
fragment's outer edge rather than the junction.

### Bound a breakend foot by its displayed region

`ARC_FOOT_PX` is 20 CSS px from the anchor, unconditionally, and an
interchromosomal arc's two feet are in **different displayed regions** by
construction. So a breakend within 20 px of a seam draws part of its foot across
that seam, over a contig the junction has nothing to say about — and a foot's
whole content is "this much sequence is retained here".

Not hypothetical framing: a two-region view of a fusion exists to put both
breakends on screen, and a reader zoomed in on one puts it near an edge.

**The obvious version is wrong and was written and reverted.** Bounding a foot by
the OTHER foot's anchor (`min(ARC_FOOT_PX, 2 * rx)` when it points that way)
looks equivalent and is not: two feet pointing the SAME way must keep overrunning
each other, since they overlap precisely because both ends keep the same stretch
and the bar they merge into is that stretch drawn (`ARC_FOOT_PX` carries the
199 bp templated insert this was measured on). A partner bound clamps exactly
that case. `arcFeetPath.test.ts` pins it against the mistake.

The right bound is each foot's own region's screen extent, which means:

- the model projecting `displayedRegions[i]`'s `start`/`end` once per resolve,
  beside `reversedByRegion` in `crossRegionArcSections` — a per-pan-frame cost,
  so measure it against the existing two `bpToPx` calls per arc;
- a per-foot max length on `ArcFeet` rather than one number, since the two feet
  hit different edges;
- `screenFeet` resolving it, for the same reason it resolves `regionReversed`
  there: it is the layer that knows which region each foot came through.

Same shape as the tick entry above — the mark says a direction, and a mark that
says it on the wrong contig is worse than one that says nothing.

### Draw one mark per interchromosomal cluster

An N-pair translocation draws **N marks per side, each claiming N**. The
clustering's own premise is that mate pairs never share a coordinate — 862 of 865
were the sole occupant of theirs — so `arcKey` and `pushLine` coalesce nothing,
every connection becomes its own mark, and `resolveArcs` hands each of them the
whole cluster's size. An 8-pair event is 8 arcs (or 8 + 8 ticks), each stroked as
though it alone carried 8 reads and each hovering "supported by 8".
`compute.test.ts` pins the current answer as `[5,5,5,5,5,5,5,5,5,5]` for five
pairs, and `ARC_BAND.md` describes the trade as "two coordinates of one event",
which is what it would be if the marks were 2.

The ink is O(N) marks at `arcLineWidth(N)` where the evidence is one junction —
the opposite of what coalescing was introduced for on the same-chromosome arm
("57% of the arcs in that window were exact repeats"), and it lands hardest on the
mark that is a full-height opaque vertical.

**The blocker is stated in `resolveArcs` and it is answerable**: "merging a
cluster would have to invent a position for it, which is the thing `arcKey`'s
exact-coordinate rule exists to refuse". A REPRESENTATIVE member invents nothing —
it is one of the reads' own coordinates, which is the rule already in force. So
the decision is which one:

- **the junction-facing extreme.** A mate-pair cluster brackets the breakpoint
  from one side, so the innermost supporting read is the tightest defensible point
  estimate, and `p1Dir` already says which side that is. Closest to what an SV
  caller would report.
- **the median member.** Robust, says nothing about direction, and reads as "the
  cluster is here".
- **an interval instead of a point**, which is the honest mark for evidence that
  is not localized: a tick widened to the cluster's own bp extent. Needs
  `arcLine.slang` to take a span rather than a position, so it is the expensive
  one — but it is the only option that does not have to choose a lie.

Whichever wins, the hover should say the localization (`±window`), and the arc arm
takes the same treatment as the tick arm. **This changes what every published
translocation figure looks like**, so land it deliberately and re-render the
`cancer_sv` set: `reference/DEMO_DATASETS.md`.

**Do not read the `arcKey` rule across to argue against merging.** That rule
refuses to merge DISTINCT junctions on a tolerance, and it is right — five
events inside 2.3 kb are five events. Here the same pass has already decided,
on both sides, with the floor spending that decision, that the cluster is one
event. Drawing it as N marks is refusing to act on a conclusion already drawn.

**And "make the clustering zoom-dependent" is the right instinct aimed at the
wrong pass.** Two questions get conflated. *What is one event* is a
library-scale fact in bp, zoom-independent, and belongs exactly where it is.
*What should be drawn as one mark* is a rendering fact in px, zoom-dependent,
and belongs at draw time. `arcsResult` deliberately does not read
`view.bpPerPx`: it is invalidation tier 4 (rebuilt on data, settings and
navigation) where zoom is tier 5 (repaint), so feeding zoom into it reruns
`groupReadsByName`, the SA walk and the whole per-read connection resolution on
every zoom step — the display's CLAUDE.md names that tier boundary as the thing
not to break, and this would break it for every lane at once. The zoom-dependent
half, if wanted at all, is a **draw-time coalescer**: given marks already
carrying a cluster id, collapse those closer than a few px. That is a
render-tier pass over the packed feed, costs no refetch, and is strictly
optional — one mark per cluster fixes the wrong-picture problem on its own, at
every zoom.

**The surface it crosses**, which is why this is not small: `arcMark`'s
`ArcDome` has one x per foot, so a mark gains an extent rather than a
coordinate; `hitTestArcBand` scans per-instance arrays, so what an index means
and what `arcLinePositions` holds both change; `formatArcTooltip` reports two
exact bp and would report a range; and a cluster's members can disagree on arm
direction where today each mark carries its own read's. Take it with a real
dataset open rather than off the fixtures — `cancer_sv/k562_bcr_abl_split` and
the HG002 300x window at 1:2,000,000 (`reference/DEEP_COVERAGE.md`), in that
order. Every argument here is an argument about what a reader concludes, and
the fixture tests cannot settle it.

### Bound an interchromosomal cluster's diameter

`clusteredInterchromSupport` is single-linkage, so the window bounds the GAP
between neighbours and not the DIAMETER of the cluster: 40 pairs spaced exactly
one window apart chain into one cluster spanning 39 fragment lengths
(`arcClustering.test.ts` has the probe shape). The prose beside it reads as a
diameter claim — "how far a supporting read can sit from the breakpoint is one
fragment length" — so the rule delivered is a density threshold and the rule
described is a distance one.

At depth the difference is not cosmetic. The pass's own measurement puts 865
interchromosomal connections in 200 kb at 300x, i.e. ~231 bp apart on the source
contig against a typical `stats.upper` of 500-700 — so the first coordinate chains
nearly everything in the window and the partner coordinate does all of the
discriminating. Whether that matters depends on how concentrated real mismapping
is on the PARTNER side, which is the thing to measure: mismapping goes to repeats,
and repeats are localized, so "both sides agree" may be weaker evidence than it
reads.

Do not change the rule before measuring it. The obvious alternative — cap a
cluster's diameter at the window and split beyond it — trades chaining for
arbitrary cut points, which is the failure mode the current form was adopted to
escape (the one-open-cluster version scored a four-read breakpoint as 1 and 3).
Measure on HG002 300x and on a sample with a known translocation, and report the
cluster size distribution under both rules before touching either.

### The read cloud's Y axis autoscales to a single outlier

`arcsYDomainBp` is `max(1000, maxFlatArcSpanBp)` with no upper bound, and every
lane shares it. One off-screen mate 50 Mb away on the SAME chromosome therefore
sets the axis for the whole display and `insertSizeTickSections` prints "50Mb" at
the top of it. Verified with two arcs: `maxFlatArcSpanBp: 50000000`.

This is the failure the interchromosomal exclusion was written to prevent
(`resolveArcs`: "one connection would rescale the whole read cloud to a 107 Mb
'insert size' and label it"), reached by the identical route from a
same-chromosome connection — and `drawLongRange` defaults true, so it is the
default path. **Note the part that is NOT a defect**: a split junction plotting at
its breakpoint gap is deliberate (`computeArcShape`, "so a split-supported SV
lands on the same ruler height as the equivalent-span discordant pair"), so
excluding `ARC_SHAPE_FLAT_SPLIT` from the domain is the wrong fix — it would put
an unpaired long-read cloud entirely on the ceiling.

The log axis limits the damage to roughly a 1.6x compression of the interesting
range rather than a collapse, which is why this is filed rather than fixed. What
it needs is a measurement, not a chosen statistic: a percentile domain is the
standard answer and is a no-op at the sample sizes where the outlier is most
visible (p99 IS the max below ~100 arcs), so picking one without deep data would
be shipping an unmeasured change to the picture. Read the span distribution off a
real 300x read cloud first. `arcYOffsetPx` already clamps over-domain arcs to the
ceiling, so whatever bound wins needs nothing downstream.

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

### Re-film the protein launch tour once protein3d ships the a3m removal

The AlphaFold a3m MSA launches are deleted in protein3d, merged as `7b70869`
(GMOD/jbrowse-plugin-protein3d#36). **The work left here waits on a protein3d
release**, not on a merge: until one ships, genomes.jbrowse.org still serves the
plugin that has them. Two things follow it.

**`proteins/annotation_1d` films a menu that is about to lose two rows.** The
tour opens the split button and holds on it, and the release leaves **Launch 3D
protein structure view** and **Launch 1D protein annotation view** where there
were four. `pnpm video --filter annotation_1d`, then `figures push --filter
annotation_1d` and commit `media.lock`. The caption no longer counts the rows,
so it survives; nothing else on the page names the removed entries.

**Then re-read the page against the shipped menu.** `genomes_proteins.md` has
had the two destinations, their caution and the third row of the "Where each MSA
comes from" table taken out already, so this is a check rather than an edit.

Why it went rather than getting fixed: the a3m AlphaFold's prediction API
advertises as `msaUrl` cannot be fetched by anyone, and no rewrite or mirror gets
around it. The whole `/files/msa/` path answers 403 at Google's edge — the
response carries none of the `x-goog-*`/`UploadServer` headers the bucket puts on
its own 404s and 200s, so it is rejected before reaching storage rather than
being a missing object. Every version suffix, AlphaFold's own documented example
(`AF-G1JSI4-F1-msa_v6.a3m`), a browser UA with a referer and a second network all
answer the same; the prediction API has no other MSA field and the OpenAPI has no
MSA endpoint; the GCS mirror carries model, confidence and PAE only; the EBI FTP
ships coordinate tars. It worked in January 2026
(google-deepmind/alphafold#1111 asks about bulk-downloading MSAs at scale), which
makes an anti-scraping rule that took individual access with it the likeliest
reading. **Colin decided not to report it to EBI** (2026-08-18) — deliberate or
not, the feature is gone either way, so don't open one.

The silent half was ours and is fixed: react-msaview `9d8af2e`
(GMOD/JBrowseMSA#111) shows a failed load instead of spinning on it forever,
which was never specific to AlphaFold and needs no release to matter here.

### Import the recipes' remaining copied label tables

`website/src/lib/spec-recipe/fields.ts` names menu labels in the click paths
shown beside every doc figure and gallery card. Half its tables import the app's
own `[value, label]` registry and cannot drift; the other half retype the labels,
and every wrong label found so far was in a copy — "Gene glyph mode" for "Gene
glyph", "Arcs"/"Read cloud" for "Show read arcs"/"Show read cloud", "Finer /
Coarser" for a control that is two buttons. `check-spec-recipes` catches these
now, but a copy that cannot drift needs no catching.

**The criterion is whether the registry's module is a leaf.** The node script
that builds the recipes cannot load a module importing React, MUI or a lazy
`.tsx`, which is why `DEFAULT_AUTOSCALE_OPTIONS` had to move out of
`scoreMenuItems.ts` into `autoscale.ts` before it could be imported —
that move is the worked example, and `ARC_DISPLAY_MODE_OPTIONS` is the case that
needed nothing.

**The three that cited an unexported registry are done**, and all three needed
the extraction rather than an export, as expected — every one of their modules
imports MUI. `arcColorOptions` became `shared/arcColorOptions.ts` (which now also
feeds the config schema's `types.enumeration`), `displayModeOptions` and
`SUBFEATURE_LABEL_OPTIONS` became `RenderFeatureDataRPC/displayModes.ts`, and two
more went with them for free: `SHOW_LABELS_OPTION_LABELS` into the leaf
`showLabelsMode.ts` already beside it, and the synteny view's `CIGAR_MODES` into
`LinearSyntenyView/cigarModes.ts`.

The rest of the ~20 tables have no cited registry at all, and several are not
convertible in principle — `SETTINGS_POPOVERS` and the `GRAPH_*` tables name
controls in a plugin this repo does not build, and the config-slot names under
`Track menu → Settings` are generated form fields rather than labels. Read the
comment above each table before assuming one is available; the ones worth doing
say where their labels came from.

### The config-read baseline's remaining 125 is mostly not display debt

`scripts/configReadTypeGaps.txt` sits at 125 unchecked source reads, down from
154 once every cross-cutting mixin named its own field table. The number invites
a sweep and the sweep would mostly be the wrong work, so the split is worth
having before anyone estimates it:

- **72 are track- or assembly-schema reads** — `name` 24, `assemblyNames` 21,
  `adapter` 14, `trackId` 13. They are filed under whichever display or widget
  file contains them, so the list reads as display debt and isn't: naming a
  display factory's schema cannot reach a read against the containing track.
- **~12 are the root config** — `theme` x5, `defaultDriver` x3, `extraThemes`
  x2, `workerCount`, `shareURL`. Blocked rather than small: the root schema is
  assembled from the plugin manager at runtime, and a base taken from
  `pluginManager.getDisplayType(…).configSchema` poisons the whole schema
  through `GetBase`, so it wants re-plumbing before naming it buys anything.
- The rest is a long tail of factories that left `configSchema` at
  `AnyConfigurationSchemaType`, usually one line each.

Grepping the baseline for `*Mixin.ts` returns four entries, and none of them is
the population the header closed — a display mixin casting its own `self` to a
widened config holder. `WiggleCommonMixin`'s is
`getConf(getContainingTrack(self), 'adapter')` and `AssembliesMixin`'s is
`readConfObject(a, 'name')` off an assembly, so both are track/assembly reads;
`EmbeddedSessionThemeMixin`'s two `getConf(self, 'theme')` reads are root-config
ones, blocked behind the same re-plumbing as the other ~12.

The mixin population is closed and should stay closed: `HostChecksSlotNames`
pins each host and the baseline's own header now says so — it used to say the
opposite ("load-bearing and ACCEPTED"), which is the sentence that had kept it
open. **Re-baseline in the same commit as any improvement**; the gate only fails
when the count grows, so a win nobody ratchets is a win that can be undone
silently.

### Move the four cubic AA ramps onto the linear one

`antialias.slang` offers two ramp shapes over one output pixel and the tree runs
both, which used to be recorded as an open preference. It is now measured:
`scripts/aa_ramp_coverage_study.ts` scores each against the exact area a
straight edge covers of a pixel, and the linear `aaRamp` is closer at every
angle — exact axis-aligned where the cubic is up to 0.096 of full ink out, and
0.043 against 0.067 at 45°. A band built as a difference of ramps is exact at
every width with the linear one; the cubic paints a half-pixel band at 0.688
coverage instead of 0.500. GPU_RENDERING.md's antialiasing section carries the
table.

So the four remaining `aaSmoothRamp` callers are a correctness debt rather than
a style: synteny's `perpCoverage` and `vertCoverage` (`syntenyTypes.slang`), the
dotplot capsule, and `glyphEdgeAlpha` — which puts it behind `pointGlyph` and
manhattan's SDFs too. Each call is a one-argument change: `aaSmoothRamp(d,
halfPx)` becomes `aaRamp(d, 2.0 * halfPx)`, since the linear form takes the full
width where the cubic takes the half.

**Start with the dotplot capsule.** Wiggle's capsule is the same primitive with
the same SDF and already takes the linear ramp, so those two differ today for no
reason anyone recorded, and it is the cleanest place to see what the change
looks like. Marks thinner than a pixel move the most — they are the ones the
cubic over-inks.

The reason this is not four one-line commits is the verification, and the
cross-backend gate is the instrument for it — `pnpm test:browser:gate` with
`--drift-report`, not a golden refresh. It diffs canvas2d against the GPU render
of the same run with canvas2d as the reference side, and `Dotplot View`,
`Synteny Views`, `Multi-Way Synteny Views` and `GWAS Tracks` are all in its CI
scope, so all four call sites are already watched. That makes the change
falsifiable rather than merely reviewable: a ramp closer to exact coverage
should move those pairs DOWN the drift distribution. Read CROSS_BACKEND_GATE.md
for the distribution to compare against — max 0.62%, median 0.00% over 66 pairs
— and note the wiggle line plots that sit at the top of it are already on the
linear ramp, so they are the control rather than the target.

## Blocked on a visual call

### Should chromosome painting colour a mate on the SAME chromosome

`mateRefName` paints every read by its mate's reference, with no
interchromosomal gate — `extractFeatureArrays` pushes `getMateRefName(feature)`
for all of them and `next_ref` resolves to the read's own contig for an ordinary
pair. So a locus with no translocations is a wall of one saturated hue, and the
signal the scheme exists for is a colour difference against that rather than
against a neutral.

It was worse than that until the palette fix (see
[ALIGNMENTS_COLOR_PARITY.md](reference/ALIGNMENTS_COLOR_PARITY.md)): with 25
chromosomes hashed into 10 colours, a translocated read stood a real chance of
being painted the background colour exactly. That part is closed. What is left is
the visual question — does a chr1 view read better with its own reads blue, or
with them neutral and only the mates elsewhere coloured — plus a real
constraint:

**The gate cannot be unconditional, because LGVSyntenyDisplay uses this same
scheme.** There it is "Query name", and every PAF block must be painted: a block
always aligns to the other assembly, so an "only if elsewhere" rule paints the
whole track. Any gate has to be about a BAM read's mate specifically, which means
the scheme stops meaning one thing. Weigh that against the picture before
changing it.

### Chain mode flags an unmapped mate but not an interchromosomal one

`readColorCategory` gives `unmappedMate` its own bucket under the plain `normal`
scheme when chain mode is on (`isOrientationScheme || (colorScheme ===
ColorScheme.normal && isChain)`), and the `interchrom` test one line below is
gated on `isOrientationScheme` alone. Both produce the same thing on screen — a
chain drawn with a partner that never arrives — so the asymmetry is either a
deliberate call nobody wrote down or an omission. `colorUtils.test.ts` covers
only the orientation-scheme half of each, so nothing pins it either way.

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

### Midnight primary is invisible on the dark-stock ground

`darkStock` changes only `mode` on top of `brandDefaults`, so `primary.main`
stays midnight `#0D233F`, and `getContrastRatio` puts that at **1.18** against
the `#121212` paper it is drawn on — against **15.9** on the light one. Every
primary-coloured element on a dark surface reads that one value.
`darkMinimal` overrides primary to `grey[700]` and does not have the problem
(3.04), so this is the stock dark theme alone.

**It is old and it is handled piecemeal**, which is the reason it needs deciding
rather than patching again. `theme.ts` carries two escape hatches already —
`darkModeContrastOverride` swaps a component's text to `text.primary`/`secondary`
in dark mode, and `darkModePrimaryIconOverride` does the same for the
`colorPrimary` icon slot — and both are MUI `styleOverrides`, so both reach MUI
components only. The docs site's link colour is a third, hand-written as forest
green at the point of use.

Found by comparing `StatusProgressBar` against the `LinearProgress` it replaced:
the two match exactly, dimness included, because both read `primary.main`. So
the bar is evidence, not the subject — **do not re-tint one component**, which
puts it out of step with everything beside it and hides the shared cause.

The visual call is which of three:

- **Give the dark presets a lighter primary**, the way `darkMinimal` already
  does. One edit in `palette.ts`, fixes every consumer at once, and changes
  JBrowse's dark branding — which is why it is a call and not a patch.
- **Add a resolved `primaryOnDark`** that `resolvePalette` fills from `mode`,
  and move the components that matter onto it. Keeps the brand colour where it
  is legible and names the intent, at the cost of a second slot every author has
  to know to reach for.
- **Keep patching per component.** Cheapest each time, and the reason the two
  overrides plus the link colour do not cover the toolkit-free components: a
  `styleOverrides` hatch cannot reach a `makeStyles` div at all, so the set of
  things it misses grows with every component that leaves MUI.

### The interbase stack overruns its half-band at a split-read breakpoint

`computeInterbaseCoverage` bakes each stacked segment as `count /
interbaseMaxCount`, where the denominator is the region's PEAK READ DEPTH. At a
clean breakend the events at one boundary can exceed that peak, because neither
group of reads covers the other's base: N reads end at P and M start at P, so
the peak is `max(N, M)` while the events at P total `N + M`. Nothing clamps the
sum — not `interbaseHistogram.slang`, not `drawInterbaseSegments` — so the bar
runs past the half-band it is scaled against and into the coverage bars.

Measured with the real functions, N = M = 40 and no spanning depth:

```
peak read depth: 40      events at P: 80      denominator: 40
tallest stackEnd: 2.000  (1.0 is the full-scale bar)
bar drawn: 90.0px        half-band budget: 45.0px
```

i.e. it eats 50% of the coverage bars' own drawing area, at exactly the locus
someone navigates to when they care. Two things bound how often it is seen, and
both are real: spanning coverage at P raises the denominator, and the
denominator is the peak over the WHOLE region, so a breakpoint away from the
region's depth peak cannot overflow.

**Both backends overflow identically, so the cross-backend gate cannot see
this** — it is the shared-bug blindness `crossBackendGate.ts` declares in its own
header, and this is a worked instance of it.

The visual call, which is why this is parked rather than fixed:

- **Clamp the stack to 1.0.** Stops the overdraw. Loses the signal that there
  are more clip events here than the region's peak depth, which is arguably the
  most interesting thing on the screen — and a flat-topped bar says "exactly at
  peak" when it means "over it". Raised and objected to on exactly that ground;
  do not treat it as the default.
- **Leave it.** The overflow is informative, and overdrawing the bars it is
  meant to be read against misleads in the other direction.
- **Change the denominator to local depth at the position.** Makes the ratio
  meaningful per position, and gives up what `interbaseBarHeightPx` chose
  regionally for: a bar of N events being the same height everywhere in the
  view.

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

### Take the MSAA target's size on a retina display

**Every GPU number in this repo came off one machine, and this is the one whose
extrapolation is alarming.** `WebGPUHal` holds one 4x MSAA colour attachment per
display, sized to its canvas and not to the data
([ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md) §"The MSAA target
is the largest per-display allocation"). It is measured at **79.2 MiB** for a
1266x4100 canvas at **dpr 1**, and dpr enters the size squared, so a retina
panel costs 4x that before the window is any wider. The arithmetic in
[reference/GPU_PORTABILITY.md](reference/GPU_PORTABILITY.md) puts an ordinary
27" retina window with its height at the canvas clamp at **640.0 MiB for one
track**, which nothing in the session counts.

`node browser-tests/probe-msaa-resize-cost.ts [frames] [pxPerFrame]`, from
`products/jbrowse-web`. **It needs Firefox Nightly, headed** — the probe's own
TRAPS section says Chrome + puppeteer does not render a WebGPU canvas at all and
a headless run measures nothing, so the retina machine has to be one that can
run it. Three things the run should settle, in the order they matter:

- **Does the formula hold at dpr 2?** It reproduces its own dpr-1 anchor exactly
  (`1266*4100*4*4` = 79.20 MiB), which is what made extending it defensible, but
  "defensible" is not "measured". If the sizes come back at 4x the dpr-1 run for
  the same CSS box, the 640 MiB figure is real and the entry above should carry
  it as a measurement rather than as arithmetic.
- **Where does the refusal actually land?** `recreateMsaaTexture` checks
  `maxTextureDimension2D`, so the predicted failure is at ~4096 CSS px tall at
  dpr 2 — and the prediction is that it *refuses legibly* rather than OOMing.
  Drag a track past that and read what the user sees. A blank canvas there is a
  bug; a zoom-in banner is the design working.
- **Is the per-frame rebuild still free?** The dpr-1 run measured 250 rebuilds
  at 1.9 ms total, flat in texture size, and concluded the driver does not
  commit at create time. That conclusion is per-driver and this is a different
  driver.

**Take `maxBufferSize` and `maxTextureDimension2D` off the same machine while
you are there** — `logGpuCapabilities` warns them to the console on every
WebGPU device acquisition, so it is a devtools read on any page that got a
device, not a probe run. Two
adapters is not a survey, but it is the difference between one data point and
knowing whether the Intel UHD 630's 1 GiB is typical or generous.

**Unrelated but the same trip, if the machine has Firefox:** the WebGL2 context
ceiling has only ever been measured on Chrome. "Firefox around 16" comes from
RFC-001 §12b, whose own superseded-in-part note says its context-cap figures
were guesses — the Chrome measurement killed its "Chrome around 8" and left the
Firefox one standing because nothing contradicted it.
[reference/GPU_CONTEXT_BUDGET.md](reference/GPU_CONTEXT_BUDGET.md) has the
harness; it walks `--tracks` up on one LGV.

### Walk the CIGAR once for a read's whole MM tag, not once per group

`forEachMaxProbMod` groups mod entries by positions-array identity, so entries
holding the same array share one CIGAR walk — the types of a combined code
(`C+mh`), and since the same-base merge, two groups like `C+h?;C+m?` as well.
**Entries from groups on DIFFERENT canonical bases never share one, and cannot**
— `C+m,…;A+a,…` is 5mC on cytosine and 6mA on adenine, so the two groups
genuinely have different positions. Such a read walks the same `ops` array twice.

Both walks are ascending, so they merge: hold one cursor per group, take the
minimum each step, walk the ops once. That turns O(N x ops + total positions)
into O(ops + total positions).

**Do not expect much from it, and this entry used to.** It claimed close to a
halving of the walk phase, reasoning that the ops term dominates (6.25M ops
against 0.84M positions). `cigarOpDensity.bench.ts` refutes it: sweeping op
density across a 5,000x range moves the walk's ratio between 1.10x and 1.18x,
because the phase is bound by per-CALL work — the 0.84M callbacks and the byte
lookups, comparisons and writes inside them — rather than by traversal. Merging
removes one ops traversal and none of the per-call work, so on this fixture it is
worth about the 5-10% that removing all the ops was, and on a low-op-density read
close to nothing.

**Two measurements have now said that from opposite directions**, which is worth
trusting more than either alone: the same-base merge shares a CIGAR walk and a
sequence walk in the same change, and splitting its number gives 1.08x for the
CIGAR half against 1.27x for the sequence half.

**This is not the exotic case.** Fiber-seq reads carry 5mC and 6mA as a matter of
course, and `modificationsMenu` already tells users that basecallers increasingly
emit several types per read. A combined code is the *rarer* shape; two groups on
one base is what dorado actually emits.

**The same-base half of this SHIPPED, and it took most of the entry with it.**
`C+h?` and `C+m?` are two groups on the same canonical base with equal delta
lists, which is what dorado emits, so `getModPositions` now compares the delta
text at parse time and hands both groups one positions array —
`sameBaseMerge.bench.ts`, 1.268x on the parse and 1.222x on the per-read
pipeline, free on every fixture where it cannot fire. What is below is what
survived that.

**The one-pass sequence walk is now a Fiber-seq optimization, and only that.**
Remeasured against the merged baseline, `multiGroupParse.bench.ts` makes htslib's
shape a **loss** below three DISTINCT groups: 0.917x at one, 0.930x at two
synthesized (`--groups=2`), 0.949x at the two real ones of the ONT fixture, and
1.385x only at fiberseq's 2.86. `A+a.;C+h?;C+m?` is three groups but two distinct
walks, so the 1.13x this entry used to quote was consumed by the merge rather
than left on the table. If it is built anyway, for `C+m;A+a;T-a`-shaped data:

- **Branch on the DISTINCT count, never the group count.** Counting duplicates
  puts the ONT case on the losing side of the branch.
- **An MM tag may ask for more of a base than the read has left, and the two
  shapes disagreed there.** `getModPositions` clamps to the nearest valid index
  for that call and every one after it; the one-pass arm dropped them, and its
  "output identical" rows only ever meant that no read in those fixtures
  overran. Get this from
  [reference/MODIFICATION_TAGS.md](reference/MODIFICATION_TAGS.md) rather than
  from memory — the clamp rule was written down wrong twice, including in this
  entry, because until it was fixed only the FIRST unplaceable call landed in
  range.

**The CIGAR half across DIFFERENT bases is what is genuinely still open**, and it
is the part with no fixture argument against it: `A+a` and `C+m` have different
positions by construction, so no parse-time merge can fold them and
`forEachMaxProbMod` walks the ops twice. Hold one cursor per group, take the
minimum each step. Expect **~1.1x on that phase and no more** — `cigarOpDensity`
puts it at 1.10-1.18x across a 5,000x op-density sweep because the phase is bound
by per-call work, and the same-base merge just measured the same thing from the
other side: sharing a CIGAR walk was 1.08x where sharing the sequence walk was
1.27x.

Keep the identity grouping when doing this — it answers a different question
(which entries are the same walk) and any merge is a layer above it.

### The swapped-assembly track resolves to a point

The hang this used to describe is fixed, and it was the follow's, not the swap's:
`alreadyShowing` can never agree with an answer narrower than the moving view's
zoom floor, and saying no means navigate, which wakes the pass that asked. A
zero-width answer now holds the row and lights `followUnaligned`, a narrow one
is matched by containment within the floor, and
`LinearSyntenyFollow.test.tsx` covers a follow on a swapped track. See
`SyntenyFollow/CLAUDE.md`.

What is left is why the answer is degenerate. `volvox_del.paf` declares rows
`["volvox", "volvox_del"]` while its adapter declares
`queryAssembly: volvox_del` / `targetAssembly: volvox`, so the level's top row is
the adapter's *target* — the swapped-assemblies case the codebase already warns
about elsewhere — and the walk clamps the anchor window to a block whose axes are
not what the plan thought, bringing both ends back on one coordinate.
`volvox_alias_control.paf` describes the same alignment with the orientation
aligned and resolves normally (`LinearSyntenyRefNameAlias.test.tsx`).

So the follow is safe on such a track but useless on one, which is the honest
state to leave it in until the swap itself is addressed: the two fixtures differ
in orientation *and* in column order, so it is still not isolated to one
variable — one more fixture would settle that. The user-facing answer may be that
`swappedAssembliesWarning` should reach the follow's own reporting rather than
that the walk should be taught to cope.

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

### Produce and host the HPRC summary tier

**Done, whole genome, hosted** —
`jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.summary.bed.gz` (1.63 MB, 375,888
rows, 464 haplotypes, 152 of 195 contigs, every primary present), wired by
`test_data/hprc_maf_summary.json` and rebuilt by
`scripts/build_hprc_maf_summary.sh`. Worth 354 Mb refused against 250 kB drawn on
whole chr6, and a whole-chromosome read costs 828 bytes to 127 kB against a 5 MB
budget ([reference/HPRC_RELEASE2.md](reference/HPRC_RELEASE2.md) §"What the
zoom-out tier is worth"). What is left is one decision and one upstream report.

**Report the overlap collapse to `maf2bed`.** `--summary` emits a haplotype's
overlapping runs separately, and `--merge-gap` structurally cannot reach them —
measured, 500 to 50,000 removes 0.04% of the rows. Collapsing them into their
union is a 13x reduction genome-wide and 69x on chr14, losslessly for what the
slot feeds. The build script carries the workaround; the producer should do it.

**Decide whether `showSummary` swaps on span or on cost**, which is what stops
the tier being switched on for `hprc_maf.json` itself. It swaps at 20 kb, and the
tutorial's own figure is drawn at 83 kb, so wiring the summary there silently
replaces the per-haplotype base rows the figure exists to show — for a detail
read of ~1.2 MB against a 5 Mb budget. The gap is the one
[reference/MAF_LARGE_BLOCKS.md](reference/MAF_LARGE_BLOCKS.md) §"What the LOD
lesson actually points at" predicted; HPRC_RELEASE2.md says why it is a design
question rather than a one-liner.

### Does a base-quality floor still buy anything on the coverage band

`mismatchQuals` ships per mismatch and drives the pileup's per-base fade
(`qualityFade`, `features/mismatch/drawCanvas.ts`); `computeSNPCoverage` ignores
it entirely, so a Q10 base and a Q40 base contribute equally to the band's
allele counts. Excluding, or down-weighting, sub-Q20 bases is the obvious other
half of the noise story and needs no new payload.

**What is unconfirmed is whether it is still worth anything.**
`coverageSnpMinFrequency` now hides an allele below a fraction of the position's
depth, and low-quality bases are most of what that already removes — the two
filters may be reading the same reads. So measure before building: on the
HG002 300x windows in
[reference/DEEP_COVERAGE.md](reference/DEEP_COVERAGE.md), what share of the
band's allele counts comes from sub-Q20 bases, and how much of THAT share
survives a 1% allele-fraction floor? If the answer is "almost none", the entry
closes.

If it survives, the design decision is exclude vs down-weight, and they are not
the same statement: excluding changes the denominator's meaning (the bar's depth
still counts the read, so the fractions stop summing to the mismatch rate),
while down-weighting keeps a fractional count the tooltip then has to render.

**Either way this is a worker-side setting, and that is the part to decide
first.** `segHeight` is baked in `computeSNPCoverage`, so a quality threshold
changes the packed buffer and every change of it costs a refetch — where
`coverageSnpMinFrequency` is free to move because the fraction it tests IS
`segHeight`, already in the instance. A quality floor gets the same freedom only
by shipping a second per-segment field (the high-quality count beside the total),
which is 4 bytes a segment for a setting most users will never touch. A config
slot with no menu entry is the honest middle, and it is what to reach for unless
the measurement says people will move it.

### Does a sixth alignments track want a sixth RPC worker

`WorkerPoolRpcDriver` sizes its pool `clamp(detectHardwareConcurrency() - 1, 1,
5)` and `rpcSessionId` is per-track, so tracks round-robin — which puts two of a
six-track session's tracks on one worker. Raising the ceiling is one line through
the `workerCount` config slot, which already overrides the hardware default.

The reason it is not obviously right is **memory, not speed**: each worker holds
its own BAM chunk caches and its own bgzf pool, so a sixth worker is a sixth copy
of both. That makes this the same measurement as
[BGZF_WORKER_POOL.md](reference/BGZF_WORKER_POOL.md) and
[ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md)'s per-context entry
rather than a stopwatch — and wasm memory is outside `Runtime.getHeapUsage`, so
it wants process-level RSS per target.

Do not reach for a wall-clock A/B first. Tracks do **not** serialise on one RPC
worker (the pool round-robins on a per-track `rpcSessionId`), and every RPC
worker profiles 100% idle through a six-track pan, so there is no queueing for
more workers to relieve.

### Read the cross-region arc count at 300x, which the arc cap is sized from

`CROSS_REGION_ARC_CAP = 600` (`features/arcs/crossRegionOverlay.ts`) is sized for
the same-chromosome multi-seam case, which is the one that is actually unbounded.
Its input is an **estimate**: 52 of 381 arcs (13.6%) were cross-region on one
seam of HG02768's inverted duplication, a ~30x paired-end sample, and that count
was then scaled by an assumed ~10x for depth and again for the number of seams.
Only the 30x half was measured.

Reading the real number is cheap — `crossRegion.length` off the model, on the
HG002 300x window split in two — and it decides whether 600 is two deep seams'
worth, as the comment claims, or off by an order of magnitude in either
direction. Note what it does *not* decide: at that depth the reader's own lever
already exists and is the one they are using, `drawProperPairArcs: false`
dropping 9138 of 9204 arcs, so the cap is a floor under the frame rate rather
than a filter, and a wrong number here degrades a picture that is a wash of ink
either way.

Three companion counts were taken at the same time and have been re-read but
never re-run, so treat them the same way: that HG02768 view yields 0
cross-region arcs both as one region and as two regions 2 Mb apart — the 52 came
from splitting it 300 bp apart — and 865 of 9204 arcs are interchromosomal at
`1:2,000,000` on HG002 300x.

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
when the sweep empties the cache (`@gmod/range-cache-filehandle`, re-exported
from `packages/core/src/util/io/`); the exported `sweepIdleCache` is a
documented extra for a caller with its own schedule, not a dangling hook. And the pool's fix could NOT have been "call
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

### Sweep the unused exports with a real tool, or close the question

Nothing in the repo looks for an exported name that no importer wants. The dead
*files* and dead *dependencies* were swept on 2026-08-16 (`f783f4444c`), and
that sweep is done — this entry is only the exports half it deliberately left.

**The premise is unconfirmed, and a grep will not confirm it.** A crude pass —
every `export const|function|class|interface|type|enum` whose identifier appears
in no other file — returns **623 names**, and spot-checking says almost none of
them are dead:

- Most are exported *types* of published packages. `@jbrowse/core` and every
  `@jbrowse/plugin-*` ship to npm, so a type nobody imports in-tree is API, and
  removing it is an ABI break — see
  [reference/PLUGIN_ABI_STABILITY.md](reference/PLUGIN_ABI_STABILITY.md).
- The examples-sites' components are consumed by Astro. A scanner that reads
  only `.ts`/`.tsx` never sees a `.astro` importer, and under `jsx: react-jsx`
  it never sees `react/jsx-runtime` either — the same blind spot that made
  `astro` and `react` read as dead dependencies in `f783f4444c`'s first pass.
- `_AssertAddTracks`, `AssertEnumListsCoverUpstream` and friends are
  compile-time assertions. Appearing once is what they are for.

So the first move is **not** to delete anything. Run `knip` (or `ts-prune`)
configured per package — entry points declared, published `exports` maps treated
as roots, `products/` separated from `packages/` and `plugins/` because only the
first is an app rather than a library — and see what survives that. If the
surviving set is small and boring, take it; if it is still noise, close this
entry and say so, because the answer is then "there is no exports problem here"
rather than "nobody has looked".

Whatever the verdict, the tool belongs in `pnpm check-docs`'s neighbourhood only
if it is quiet on a clean tree. A gate that reports 600 findings teaches everyone
to skip it.


### Time a two-tier PIF to settled, in a browser

The v5.0.0 draft carried a two-tier benchmark table nothing in-repo backed, so
the paragraph came out. **The bytes half is now taken** —
[measurements/pif-tier-wire-bytes.json](measurements/pif-tier-wire-bytes.json)
(`bench`), one whole-genome pass over the hosted hs1-vs-mm39 PIF with the bytes
counted by the server the adapter fetches from. What is left is the half a
stopwatch answers.

Do **not** repeat the reasoning that wrote this off. The removed caption named a
UCSC liftOver chain, and the objection was that `ChainAdapter` declares no
tiering slot while `make-pif` takes PAF — but a chain is a *source format*, not
the adapter: `chain2paf` then `make-pif` gives a two-tier PIF that loads through
`PairwiseIndexedPAFAdapter`, which does declare the slot.
`~/data/hs1ToMm39/hs1ToMm39.over.chain.pif.gz` is one, and
[reference/HOSTING.md](reference/HOSTING.md) has recorded the hosted copy as
two-tier since 2026-08-02.

What is still owed:

- **Time to settled**, using the same `data-app-phase="ready"` gate the figure
  captures use, so it is the number a reader experiences rather than a fetch
  timing. The measurement above deliberately publishes no wall-clock: served
  over loopback it is parse time, and it moved 27% between two runs of one arm.
- **The zoomed-in view**, where the fine tier is what should be served and the
  coarse tier's advantage ought to vanish. Only whole-genome is measured, and a
  release note claiming a win needs the case where there isn't one.
- **The crossing cost**: zooming across `coarseBpPerPxThreshold` refetches, and
  on a single-tier file it refetches identical bytes — see
  [ideas/single-tier-pif-refetches-at-the-threshold.md](ideas/single-tier-pif-refetches-at-the-threshold.md).

Land it as a `measurements/` record with a `repro`, so the next release note
quotes it through the generator rather than retyping it.
