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
building first would be guessing. Nine are blocked on a visual call that is
not the implementer's to make.

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
| [Should a track's height be bounded at all](#decide-whether-a-tracks-height-should-be-bounded-at-all) | GPU, limits | the blank is fixed; what is left is whether the drag should stop, and per display |
| [A repeat's subpart labels collide in one row](#a-repeats-subpart-labels-collide-inside-the-row-they-now-share) | canvas | the row is reserved now; decide whether the one-row design survives |
| [Let a dotplot click open the alignment it is on](#let-a-dotplot-click-open-the-alignment-it-is-on) | dotplot | the pick already answers; decide ship-ids vs resolve-on-demand first |
| [Import the recipes' remaining copied label tables](#import-the-recipes-remaining-copied-label-tables) | website, menus | check each registry's module for a React import; a leaf is importable today |
| [A validator gate for the examples sites' configs](#decide-whether-the-examples-sites-configs-get-a-validator-gate) | embedded, config | the file is fixed; what is open is the copy and where a gate lives |
| [An arc's right-click offers nothing](#give-an-arcs-right-click-something-to-offer) | alignments, arcs | decide the item set; the hit already resolves coordinates and support |
| [A config slot for `bezierRadiusRatio`](#decide-whether-bezierradiusratio-becomes-a-config-slot) | circular view, config | decide whether the state-model property stays beside the slot |
| [A fixed tick pool for the coordinate ruler](#give-the-coordinate-ruler-a-genuinely-fixed-tick-pool) | LGV, perf | the key half landed; what is left is the count delta |
| [Read the drift the AA ramp conversion predicts](#read-the-cross-backend-drift-the-aa-ramp-conversion-predicts) | shaders, GPU | all four converted; run the gate with the MSAA sample count held fixed |
| [Extra large text SVG mode](#extra-large-text-svg-mode-for-pub-ready-figures) | SVG export | thread a scale the way `fontFamily` threads |
| [Alignments / canvas odds and ends](#alignments--canvas) | alignments, canvas | seven independent small items |
| [Group the methylation path's CIGAR walk](#group-the-methylation-paths-cigar-walk-the-way-the-marks-path-now-is) | alignments, perf | decide whether the exported callback's order is a contract |
| [A same-strand hidden junction is still solid](#a-same-strand-junction-across-unfetched-segments-is-still-drawn-solid) | alignments | decide which renderer owns a marked junction; `isNormal` sends it to the straight pass |
| [Give colorNeutralRead a dark variant](#give-colorneutralread-a-dark-variant-or-fold-it-into-colorpairlr) | alignments, palette | decide two neutrals or one before editing either |
| [Re-film the protein launch tour](#re-film-the-protein-launch-tour-once-protein3d-ships-the-a3m-removal) | figures, protein3d | waits on a protein3d release; the a3m is gone for good |
| [Should chromosome painting colour a same-chromosome mate](#should-chromosome-painting-colour-a-mate-on-the-same-chromosome) | alignments | a visual call; any gate has to spare LGVSyntenyDisplay's Query name, which must paint every block |
| [Chain mode flags an unmapped mate, not an interchromosomal one](#chain-mode-flags-an-unmapped-mate-but-not-an-interchromosomal-one) | alignments | decide whether the asymmetry is deliberate; `colorUtils.test.ts` pins neither half |
| [What colour is an arc with no pair orientation](#what-colour-is-an-arc-with-no-pair-orientation) | alignments | a visual call, then one of two edits |
| [Midnight primary is invisible on dark stock](#midnight-primary-is-invisible-on-the-dark-stock-ground) | palette, theme | pick one of three; never re-tint a single component |
| [The interbase stack overruns its half-band](#the-interbase-stack-overruns-its-half-band-at-a-split-read-breakpoint) | alignments | a visual call; the overflow is measured, no fix is chosen |
| [Make the capture scroll-invariant](#make-the-snapshot-capture-scroll-invariant-then-widen-the-gate-to-webgpu) | browser tests | it is `snapshot.ts`, not a shader — attribution is done |
| [Attribute the TIMEOUT mode](#attribute-the-60s-displaypainted-selector-wait) | browser tests | the census shipped; wrap the two selector waits that throw before it runs |
| [Make the webgl blank verdict conclusive](#make-the-webgl-blank-verdict-conclusive) | browser tests | `--real-gpu` already discriminates; decide whether the override is still worth a run |
| [Overlay labels cover the row below](#overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes) | canvas | decide: reserve a row, or call overlay normal-mode only |
| [Shoot the multihop chain as counted arcs](#shoot-the-multihop-chain-as-counted-arcs-in-one-lgv) | figures, alignments | take the partner windows from the nanomonsv VCF, not the picture |
| [Re-render the settings-menu figures](#re-render-the-five-figures-the-settings-menu-refactor-outran) | figures, synteny | five stale; the lock cannot catch this class |
| [Rebuild the OrthoFinder demos' chrom.sizes](#rebuild-the-three-orthofinder-demos-chromsizes) | figures, synteny | rerun the script into `demos/`, then re-render three; raise alpha only uniformly, if at all |
| [A pure reducer for the byte-gate commit protocol](#pull-the-byte-gate-commit-protocol-into-a-pure-reducer-the-fuzzing-can-reach) | region-too-large, tests | the truth table cannot see action sequences; the tier-key fix is the class a random walk finds |
| [The tier hook's budget reads the wrong adapter](#the-tier-hooks-byte-budget-still-resolves-off-the-tracks-main-adapter) | region-too-large | inert today; the fix is the hook carrying a config node, not a snapshot read |
| [Delete or implement the RPC `timeout` option](#delete-or-implement-the-rpc-timeout-option) | RPC | delete half done; the implement half goes in `RpcHandles` |
| [Brand the out-of-request refNames](#brand-the-out-of-request-refnames) | synteny, RPC | type-only; brand BOTH ends or the compare still passes |
| [Give `session.jbrowse` a real type](#give-sessionjbrowse-a-real-type) | core types, MST | pick one interface or two BEFORE touching any of the 36 sites |
| [The swapped track resolves to a point](#the-swapped-assembly-track-resolves-to-a-point) | synteny | the hang is fixed; what is left is the swap, still not isolated |
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
| [Sub-pixel matrix rows draw 1px on the GPU and thinner on Canvas2D](#a-sub-pixel-matrix-row-draws-1px-on-the-gpu-and-thinner-on-canvas2d) | variants, backends | a visual call; the 41% is measured and neither side is obviously wrong |
| [Fill the hi-C rectangle, not just the triangle](#fill-the-whole-display-rectangle-not-just-the-hi-c-triangle) | hic, GPU | decide what the y axis means once the apex stops bounding it; the cost is measured |
| [Observer reactions leak from discarded renders](#destroying-an-mst-tree-that-something-still-observes) | app-core, drawer | give each lazy its own Suspense boundary; verified 2 leaked -> 0 |
| [Cut WebGL2 contexts per display](#cut-webgl2-contexts-per-display) | GPU, limits | build — ceiling measured at 16, one ordinary view crosses it |
| [Produce and host the HPRC summary tier](#produce-and-host-the-hprc-summary-tier) | MAF, pangenome | built and hosted; report the overlap collapse upstream, then decide span vs cost |
| [Does a sixth track want a sixth RPC worker](#does-a-sixth-alignments-track-want-a-sixth-rpc-worker) | RPC, limits | one `workerCount` line to try; the answer is a memory measurement, not a stopwatch |
| [Cross-region arc count at 300x](#read-the-cross-region-arc-count-at-300x-which-the-arc-cap-is-sized-from) | alignments, arcs | one `crossRegion.length` read; the cap's input is an estimate |
| [Does a quality floor still buy anything on the band](#does-a-base-quality-floor-still-buy-anything-on-the-coverage-band) | alignments | measure the sub-Q20 share that SURVIVES the frequency floor |
| [Walk the CIGAR once per MM tag](#walk-the-cigar-once-for-a-reads-whole-mm-tag-not-once-per-group) | alignments, perf | the same-base half shipped; what is left is worth ~1.1x and is Fiber-seq only |
| [Alignments main-thread repack](#alignments-still-repacks-every-row-instanced-pass-on-the-main-thread) | alignments, GPU | profile the pack/upload/clone split first |
| [Stop rewriting the worker's arrays](#stop-rewriting-the-workers-arrays-to-lay-out-features) | canvas | count the consumers — they decide if it is worth it |
| [The SV inspector rebuilds its chord track per filter](#the-sv-inspector-rebuilds-its-chord-track-from-the-whole-callset-per-filter) | SV inspector | time it on a callset in the thousands, not the 44-row table |
| [One inflate pool and byte cache per session](#give-the-rpc-workers-one-inflate-pool-and-one-byte-cache-between-them) | bgzf, RPC, limits | the speed premise is measured out; weigh the wasm memory, or close it |
| [The comparative context menu sits behind no seam](#the-comparative-context-menu-sits-behind-no-bring-your-own-seam) | synteny, dotplot, embedded | fetch status done, tooltip refused; the context menu needs a shape of its own |
| [Sweep the unused exports, or close the question](#sweep-the-unused-exports-with-a-real-tool-or-close-the-question) | tooling, CI | configure knip per package; a grep returns hundreds of names and almost none are dead |
| [charactersPerRow is a constant on a model](#charactersperrow-is-a-constant-living-on-a-model) | feature details | decide setting vs const; a setter with no UI is the worst option |
| [Download plaintext writes an unreadable FASTA](#download-plaintext-writes-a-fasta-no-tool-can-read) | feature details | a product call, and it moves "Copy plaintext" too |
| [The config-read baseline's remaining 129](#the-config-read-baselines-remaining-129-is-mostly-not-display-debt) | config, types | 75 of them are track/assembly reads; confirm that before estimating any of it |
| [Time a two-tier PIF to settled](#time-a-two-tier-pif-to-settled-in-a-browser) | synteny, PIF | bytes are measured; what is left wants the app and the ready gate |
| [Do the plugin `exports` surfaces earn a baseline](#do-the-session-and-plugin-exports-surfaces-earn-a-baseline) | plugins, ABI | recorded; build the plugin-`exports` baseline, and read the session one's blocker first |
| [v4.3.0's per-view highlight setting is dropped on load](#v430s-per-view-highlight-setting-is-dropped-on-load) | session, compat | decide migration vs upgrade-guide note; MST ignores the key either way |

## Ready to build: small and self-contained

### A repeat's subpart labels collide inside the row they now share

`layoutRepeatRegion` reserves the shared label row now (`sharedChildLabelRows`,
2026-08-22), so nothing overflows into the feature below — what is left is
legibility *inside* that row, and on a real EDTA-style intact retrotransposon it
is bad. Measured on the fixture in `belowLabelRows.test.ts`: four of the five
subpart labels sit at exactly y=10, and the internal `*_retrotransposon` body is
the only one offset, by 1.75px, because `centerShrink(…, 0.65)` ends its box at
8.25.

Each label is pinned to its OWN span's left edge by `computeLabelLeftPx` and no
decimation runs among siblings sharing a row, so "TSD-left" (x=100, 40px wide)
runs straight over "LTR-left" (x=105), and "Copia-internal" (x=105, y=8.25) lands
on top of "LTR-left" (x=105, y=10). Side-by-side subparts are fine by
construction; the internal span, which *contains* the LTRs, is the one that
cannot share a row with them.

**First move: decide whether the one-row design survives.** The repeat glyph puts
every subpart on one row deliberately — that is what makes a repeat one row tall
instead of five. Horizontal collision resolution among one feature's subparts
keeps that and is mechanical (drop a label whose box overlaps a sibling's, the
way the display already drops labels that do not fit a block). Stacking
non-adjacent subparts onto their own rows reads better and gives the design up,
so it is the call, not the implementation, that is open.

Not an overflow bug and not a regression: all of it stays inside the row the
reservation buys, and `belowLabelRows.test.ts` pins that boundary.

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
gate has to exempt them, which is its own small design question. Nor are the two
surviving `"showLabels": "auto"` reads in that file drift: that is the current
slot name under a current value, so nobody should "fix" those either.

### Give an arc's right-click something to offer

A right-click on an arc or a tick falls through to the browser's menu, because
`contextMenuTargetForHit` returns `undefined` for `type: 'arc'`. The fall-through
itself is the right rule — an empty menu is worse — so what is open is whether a
junction really has nothing, and it does not look that way: `ArcHitResult`
carries `x1`/`x2` in absolute genomic bp and the `support` count behind the
stroke width, and `ArcLineHitResult` carries `bp` plus `partnerRefNames`, which
is exactly the "where does this reach" a tick's own geometry cannot show. Center
on the mate, open the far side in a new view, copy the junction — all reachable
from what the hit already resolved.

Two things are in the way, and the second is the design question. `ArcMarkHit`
narrows the hover to `{tooltip, highlight}` and drops the `ArcBandHitResult`
behind them, so the coordinates do not survive to the menu builder — cheap to
fix. Then `ContextMenuHit` **requires** `block` and `genomicPos`, and its comment
says why: "a menu built without one was never a real state", which the split-state
sort bugs earned. An arc resolves an `ArcHitRegion`, not a `ResolvedBlock`, so
either arcs get a real block or that invariant needs a considered second shape.
Don't relax it casually.

Decide the item set first — it is a product call, not an implementation one.

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

### Extra large text SVG mode for pub-ready figures

`BaseExportSvgDialog` exposes font *family* only. Text size is per-element
(explicit `fontSize` attrs plus `SvgCanvas` labels), so a scale factor has to
thread through the same path `fontFamily` takes (`wrapSvgExport` →
`SVGExportRoot`) and every explicit `fontSize` has to become relative, or
labels will overflow the boxes laid out for them.

### Alignments / canvas

- Group by strand, `plugins/canvas`. There is no FEATURE grouping in the canvas
  pileup path today — `applyRowGroups`
  (`LinearMultiRowFeatureDisplay/sourcesLogic.ts`) groups source ROWS, which is a
  different axis and shipped with its own config slot, legend and SVG export — so
  the vocabulary to copy is still
  `plugins/alignments/src/shared/groupFeatures.ts` (`GROUP_BY_DIMENSIONS`,
  section dividers).
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

### A same-strand junction across unfetched segments is still drawn solid

The inverted and cross-region cases are fixed (`68eab1e8c7`): the bezier overlay
walks the SA tags of the segments it did fetch, dashes a junction that spans one
it did not, and names the hidden loci in the hover, in the breakpoint split
view's own wording. **A same-strand junction is not fixed, and the reason is
ownership rather than plumbing.** `isNormal` is true for it, so
`isBezierArcPair` hands it to the GPU/Canvas2D straight-line pass and the overlay
never sees it — it still draws one solid line across segments nothing fetched,
which is the same lie in a different renderer.

Routing those to the overlay is the obvious move and is not obviously right: in
chain mode it would double-draw over `buildChainConnectingData`, and the straight
pass is the cheap one precisely because it carries no per-read SA parse. The
alternative is to teach the straight pass a dash, which means a per-instance flag
in a buffer built for position and width alone.

**First move: decide which renderer owns a marked junction**, because that
decides whether the SA walk moves or is duplicated. Note the walk itself is
already paid on the overlay's side and is scroll-invariant
(`enumerateBezierPairs`), so the cost question is only about the straight pass.

Cost of the landed half, for scale: +0ms on a 200k short-read fetch with no SA
tags, +30-45ms per relayout on 20k ONT at 10% split, and +372ms at 50% split with
900-op SA CIGARs — down from +619ms by parsing a record's locus only after its
clip proves it hidden (`getClip` is head-or-tail digits; `lengthOnRef` walks every
op).

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

### Attribute the 60s `displayPainted` selector wait

The other failure mode next to blank captures: a display never satisfies
`displayPainted` inside 60 s — the readiness attribute, not a mutating test id,
since `b7f076fe04` deleted the `-done` suffix wholesale and made it
`data-display-drawn` (ADR-065).

**The census this asked for shipped.** `23d6fda584` added
`pendingDisplayStates` / `describePendingDisplays`
(`products/jbrowse-capture/src/sessionGate.ts:284-341`, tested in
`pendingDisplays.test.ts`), which `snapshot.ts:271` consumes — re-reading the DOM
at report time rather than off a held handle, exactly as this asked — so a wait
that expires names each unpainted display and its own `data-display-phase`.

**What is left is the wait that runs first.** `canvasSnapshot`
(`products/jbrowse-web/browser-tests/snapshot.ts:479-489`) opens on a bare
`page.waitForSelector(selector, { timeout: 60000 })` and throws puppeteer's
opaque `TimeoutError` before `waitForCaptureSettled` — and so before that census
— runs at all; `helpers.ts:47-77` is the same shape at a 30 s default. Those two
sites are the work: catch the timeout, run the census that now exists, re-throw
with it. `waits.ts` already notes the shape it will report
(`products/jbrowse-capture/src/waits.ts:163-165,199-206`): a display in a
terminal `tooLarge`/`renderError` state renders no wrapper and so can never
report painted, which reads as a timeout forever.

An earlier attempt was reverted (`839113dabe`) — re-query the selector per
attempt rather than holding the handle, and prove the mechanism on a targeted
reproduction first.

### Make the webgl blank verdict conclusive

Half the blank captures are unattributable, and the self-report now says which
half it is in rather than reading as agreement: `canvasSelfReport`
(`products/jbrowse-web/browser-tests/snapshot.ts:332-385`) probes
`getContextAttributes().preserveDrawingBuffer` and, on a volatile buffer, states
outright that a blank readback "says NOTHING about which side failed" and to
re-run that one test with `--real-gpu` (`runner.ts:83`) — a SwiftShader
compositing blank does not survive it, a render one does. That is `29f47a637d`,
and it is the readable half done.

The diagnostic itself still does not exist: nothing overrides `getContext`
through `evaluateOnNewDocument` to turn `preserveDrawingBuffer` on, and
[CROSS_BACKEND_GATE.md](reference/CROSS_BACKEND_GATE.md):105-113 records it open
as a diagnostic while refuting it as a *fix*. **This is one deliberate run, not
another A/B, and it must not be left on.**

**But the cheap discriminator lowers what the run buys.** `--real-gpu` is a real
flag that separates the two sides on the one test that failed, with no build
override and nothing to verify against a plain canvas first — so decide whether
the override is worth doing at all before taking it.

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

### Re-render the five figures the settings-menu refactor outran

`figures.lock` was last written partway through that refactor, and two commits
after it reshaped the menu those figures photograph — a slider became a chevron
row and the sections were reordered by arity, so every captured menu is a
picture of a shape that no longer exists. `genomes_synteny/ribbons_default` also
boxes **CIGAR indels** and **Curved lines** at rows that have since moved, and
it contradicts the prose committed alongside it ("checkboxes come first, then
the choices, then the values").

Stale, all needing the browser pipeline:

- `genomes_synteny/ribbons_default`
- `genomes_synteny/ribbon_settings` — `mode: 'compose'` over the above
- `hg002_haplotypes_location_markers` — its `viewportHeight: 500` was sized for
  the taller pre-refactor menu and wants re-checking, not just re-rendering
- `bigwig/whole_genome_coverage`
- `tracklabels` — its viewport grew

The first three are the ones the refactor itself invalidated; the last two were
already known. Nothing in the lock can catch this class — it hashes the bytes in
S3, not whether the UI still looks like them.

### Rebuild the three OrthoFinder demos' `chrom.sizes`

`598b8c05ef` changed the build script and nothing else
(`scripts/build_orthofinder_synteny.sh:203-238`), and
`demos/orthofinder_{grasses,vertebrates,wheat}/` have not been touched since
`ffa68a2e84` — so every published figure is still drawn off the largest-30 rows,
and the two spec-side workarounds are still carrying it
(`website/scripts/specs/synteny.ts:2050-2058` and `:2167-2171`).

**The blocks dedupe this entry used to be about is already in the pictures**, so
what follows is a SECOND re-render of the three OrthoFinder figures rather than
the first. `85afc7733f` landed on 08-14 and all five `.blocks` figures were
re-published twice after it — `9ce66dea98` on 08-15 and `572633a842` on 08-20,
both against the local build (`website/scripts/specs/synteny.ts:876-882`), so the
deduped adapter was in force and the ribbon losses have landed.

**Rebuilding is cheap** — one pass over each GFF3 and BED, no OrthoFinder run —
and has to reach `demos/orthofinder_*/` for the figures to see it. The script now
picks the 30 sequences carrying the most genes rather than the longest 30, which
is a different 30 on most of these genomes: 14 of frog's 30 held no ortholog at
all, 18 of urartu's and 12 of tauschii's, while nine real chicken microchromosomes
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

### The comparative context menu sits behind no bring-your-own seam

**`ComparativeFetchStatus` is done and the tooltip was refused — the context menu
is the whole of what is left.** `SyntenyContextMenu`
(`LinearSyntenyDisplay/components/SyntenyContextMenu.tsx:1-3`) reaches
`@jbrowse/core/ui`'s `ContextMenu` directly, which is `CascadingMenu.tsx:11` and
so `@mui/material`, behind no seam at all — so an embedder who mounted
`DisplayUIProvider` to keep Material off the page still gets it from a synteny or
dotplot right-click.

**The tooltip is NOT open, and it is the one thing here not to redo.**
`ComparativeTooltip.tsx:1` goes through `@jbrowse/core/ui/BaseTooltip`, which
lost `@mui/material` in `2377b8b9c9` and is pinned there three times —
`muiFree.test.ts` in both `core` and `display-ui`, plus `BaseTooltip.test.tsx`.
A third seam for it was considered and rejected on the record:
[reference/DISPLAYCHROME.md](reference/DISPLAYCHROME.md):955-963, "reach for the
palette before reaching for a fourth context".

The fetch status now goes through the seam, and the design question this entry
posed turned out not to be one. Its two states *are* `DisplayChromeOverlays`
entries — `Loading` and `BackgroundProgress` — and `ComparativeStatusModel`
already satisfies both of their model shapes structurally, both being
`{statusMessage?, statusProgress?}`. So it needed no new contract and no second
one: `synteny-core` depends on `@jbrowse/display-ui`, reads
`useChromeOverlayOverride()`, and falls back to a Material pair it binds itself
(a package cannot depend on `plugin-linear-genome-view`'s bindings).
`ComparativeFetchStatus.test.tsx` pins both directions.

**Check the shape before designing a contract for the one that is left.** The
context menu genuinely is its own shape, so it wants an entry of its own or a
second small contract in the same package — but the fetch status looked like that
too until someone compared the interfaces.

**One piece of this is fixed and the rest is latent, which is the trap.** The
loading bar was the only one that rendered without the user doing anything, and
`StatusProgressBar` is now toolkit-free, so the hole that was measured is closed
on the axis it was measured on: the BYO site's `synteny` page reports 0 Material
elements at rest **and** 0 during its first load. Everything else on that path is
Material and simply has not been reached yet — the context menu wants a
right-click, and `LoadingOverlay`'s cancel and retry are `IconButton`s that only
appear when a caller passes the handlers.

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
covers the cancel and retry buttons the moment a caller passes those handlers.
The context menu is what it cannot reach: it needs a right-click nothing on that
page drives.

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
(`features/arcs/mark.ts`, `arcPath.ts`, and
[reference/ARC_BAND.md](reference/ARC_BAND.md):296, whose `:352` also has the
foot's unconditional length). An interchromosomal connection whose partner is
**off screen** draws as a pair of TICKS instead, and those have no feet.

That is unfinished, not declined. A tick means "the partner is somewhere you
cannot see", and the direction at the near foot is exactly as informative there
— arguably more, since there is no second endpoint to read the orientation off.

It was left out because the two draws are not the same kind of thing. The feet
live in the SVG cross-region overlay, which re-traces `arc.mark` in TypeScript;
`arcLine` is a GPU/Canvas2D pass. So this one needs a per-instance direction
attribute, geometry in `arcLine.slang` plus `pnpm gen:shaders`, the Canvas2D
mirror, the SVG export, and a decision about whether a foot is part of the
tick's hit-test target. Roughly a day. Nothing in the landed arc work blocks it,
and `LinearAlignmentsDisplay/components/arcBreakendFeet.test.ts` exists now,
which is where a tick-foot direction assertion lands.

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
  chosen donors — which is what a graph-beside-callset figure like
  `hprc_graph_vs_callset` wants. The design ask is real; the pointer this used to
  carry is not, since that figure's review verdict is `good` and
  `screenshot-review.json` holds no `open` statuses at all.
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
- **Regenerate the graph figures, if a pitch change is still owed.**
  `ROW_HEIGHT_PX` has no trace in this repo, and every graph figure has been
  republished at least twice since this was written (`fd707c4bff`, `82b3cdcde8`),
  heights dropping the way a row-pitch change would — so read one against the
  plugin before rendering anything. If it IS owed, the change moves every
  anchored figure by design, which is exactly why it must not go out piecemeal.
- **`graph.slang` would stretch every stroke's half-width by `scaleY/scaleX` on a
  row layout.** Dead code today — `createGraphRenderer` returns Canvas2D
  unconditionally — but `GraphRenderer.ts` states the one-token fix for whoever
  lands a GPU backend.
- **Launch the graph view from a clicked segment.** The data side is ready:
  `links.bed` states both endpoints in full, precisely so a reference segment can
  reach an off-reference neighbour. The affordance belongs in the plugin repo.

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
Both were rendered and rejected; what each of the four shipped spreads is an
instrument for is `website/docs/user_guides/graph_genome_view.md:268-288`, and the
review notes are in `0c432e1141`. The fourth, `wide`, is untried here and is not
worth trying: it is `open`'s floor lifted higher, so it clamps the same nineteen
nodes, which is the arithmetic above rather than a matter of taste.

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
the wrong primitive** (`vg mod -u` measured at 0.95% on HPRC chr20, because at 90
haplotypes almost no node has bidirected degree 2 — the number is
[reference/PANGENOME_GRAPHS.md](reference/PANGENOME_GRAPHS.md):661-663, which
credits an `adr-014` that does not exist), and
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
were four. It has since been re-filmed for an unrelated reason (`5a3ffee134`,
2026-08-21, `media.lock` committed with it), so the move is to check whether that
clip already shows the shipped menu rather than to film it again. The caption no
longer counts the rows, so it survives; nothing else on the page names the
removed entries.

**Two spec-side descriptions still say four, and they now contradict each
other.** `website/scripts/videos/proteins.ts:240-241,287` and
`website/scripts/specs/features.ts:137` both describe the four-destination menu
while `features.ts:96-99` already records that protein3d removed two. Worth
fixing in the same pass, whichever way the clip comes out.

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
convertible in principle — the `GRAPH_*` tables name controls in a plugin this
repo does not build, and the config-slot names under `Track menu → Settings` are
generated form fields rather than labels. `SETTINGS_POPOVERS` is not one of them:
it is `SETTINGS_SURFACES` since `d2b71b3a48`
(`website/src/lib/spec-recipe/fields.ts:1465`) and both its labels are in this
repo — `'Synteny display settings'` at `SyntenySettingsMenu.tsx:91`,
`'Dotplot display settings'` at `DotplotSettingsMenu.tsx:54` — so it is
convertible under the criterion above, as an extraction rather than an export,
since both modules import MUI. Read the comment above each table before assuming
one is available; the ones worth doing say where their labels came from.

### The config-read baseline's remaining 129 is mostly not display debt

`scripts/configReadTypeGaps.txt:35` sits at 129 unchecked source reads — 147 more
in tests, of 911 config accessor calls in all — down from 154 once every
cross-cutting mixin named its own field table, then ratcheted to 125
(`a39ec369c0`) and re-banked at 129 by `d38e201db0`, whose message enumerates the
five new gaps and the one that left. The number invites a sweep and the sweep
would mostly be the wrong work, so the split is worth having before anyone
estimates it:

- **75 are track- or assembly-schema reads** — `name` 25, `assemblyNames` 22,
  `adapter` 14, `trackId` 14. They are filed under whichever display or widget
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

### Read the cross-backend drift the AA ramp conversion predicts

**All four conversions landed** — the dotplot capsule (`856cdbcd86`), synteny's
`perpCoverage` (`2edb510788`) and `vertCoverage` (`c95c98985c`), and
`glyphEdgeAlpha` (`71d557895a`), which took `aaSmoothRamp` out of the module with
it. What is owed is the measurement, and it is owed rather than skipped because
the change was posed as a falsifiable prediction.

The gate run was started and cut off partway (25 of 136 pairs), so there is no
number:

```sh
pnpm --filter @jbrowse/web build
cd products/jbrowse-web && node browser-tests/runner.ts \
  --backend=all --skip-webgpu --swiftshader --gate-only --ci-gate --drift-report
```

A ramp closer to exact coverage should move those pairs **down** the distribution
[reference/CROSS_BACKEND_GATE.md](reference/CROSS_BACKEND_GATE.md) records — 66
pairs, max 0.62%, median 0.00% — not merely somewhere else. `Dotplot View`,
`Synteny Views`, `Multi-Way Synteny Views` and `GWAS Tracks` are all in CI scope,
so all four sites are watched. The wiggle line plots at the top of that
distribution were already linear, so they are the control rather than the target.

**Two things a re-run needs that the first two attempts did not have.** Both
died to a *second* `browser-tests/runner.ts` running in the same worktree — one
was reaped at 117/136, the other wedged on `BigWig Tracks > GC content track`,
which the other run was filtered to, and that run's wrapper does
`rm -rf __snapshots__` before restoring its own goldens. So: check
`ps -Ao command | grep runner.ts` first, and take the gate on a quiet worktree.

**Revert order matters now.** `aaSmoothRamp` was deleted with its last caller,
because slang dead-code-eliminates an uncalled function out of every compiled
shader and `pnpm gen:shaders` then fails its own `//! js-skip` check for naming a
function no emitted shader contains. Reverting one of the three earlier
conversions alone therefore calls a function that the fourth commit removed. It
fails loudly at `gen:shaders` rather than silently, but revert the fourth first.

#### Three cubic edge ramps never went through the module

The count of four was the count of `aaSmoothRamp` CALLERS, and it undercounts
cubic ramps: three shaders open-code the same one-pixel edge ramp without
reaching `antialias.slang`, so the coverage study's finding applies to them
unchanged.

- `plugins/variants/.../shaders/variant.slang:184` — `smoothstep(-0.5, 0.5, d)`
  on the inversion triangle's SDF. Watched suite: `Variants Track`.
- `plugins/alignments/src/shaders/slang/indicator.slang:59` —
  `smoothstep(0.0, 1.0, min(dLeft, dRight))`, and the variable is called `aa`.
- `plugins/canvas/.../passes/shaders/continuation.slang:235` —
  `1.0 - smoothstep(0.5, 1.5, edgePx)` off `fwidth`. **Read the comment above it
  first**: it says the Canvas2D twin has a stake in this one, so it "wants a
  capture and not a refactor".

Not in this set, and not to be swept up with it: `variant.slang:185`'s
`smoothstep(0.0, 3.0, min(w, h))`, `gap.slang:35` and `overlap.slang:51` are
FADES over several pixels rather than edge ramps over one. A cubic easing is a
defensible choice there and the coverage study says nothing about it.

**Hold the MSAA sample count fixed, or the number means nothing.** The
per-display sample count landed the same day (`bea2ae1546`) on the same
primitives — `glyphEdgeAlpha` sits behind `pointGlyph` and manhattan's SDFs, and
the MSAA-dependent set is wiggle/coverage bar tops, read arrow tips and the tiled
Hi-C/LD diamonds. A run spanning both changes produces a drift table neither
effort can attribute, so record the commit it was measured at. The antialiasing
section of [reference/GPU_RENDERING.md](reference/GPU_RENDERING.md) carries the
coverage table and this same warning.

### Do the session and plugin `exports` surfaces earn a baseline

The recording half is done (`8e0893831f`): the six v5 removals are in
`SESSION_AND_PLUGIN_REMOVALS` in `knownRemovals.ts`, rendered into both
`PLUGIN_ABI_STABILITY.md` and the v5 upgrade guide by
`generate-abi-removals.ts`, and `knownRemovals.test.ts` guards the two-array
split. They could not go in `REMOVAL_GROUPS`: `abiPreviousRelease.test.ts`
requires every key there to be a `module#name` the previous release served, so a
session member filed there fails as stale.

What is left is whether either surface earns a baseline of its own, and the
answer differs by surface:

- **The plugin `exports` object is the cheap one and the one worth building.**
  It is shaped exactly like `abiBaseline.json`: from a product that loads every
  plugin, `pluginManager.plugins.map(p => [p.name, Object.keys(p.exports)])`
  against a committed JSON. Nothing observes that surface today —
  `check-published-plugins.ts:152` filters on `name.startsWith('@jbrowse/core/')`
  — and it is what would have caught `LinearGenomeViewPlugin.exports` dropping
  `BaseLinearDisplay`.
- **A session baseline has a concrete blocker.** The record lives in
  `packages/core` and `./ReExports/knownRemovals` is not in core's `exports` map;
  `packages/core/scripts/generateExports.mjs` derives that map FROM USAGE, so
  importing the record from `products/jbrowse-web` would silently add a permanent
  published subpath for a data module. Accept the subpath, move the record, or
  duplicate the list and let it drift — pick before writing any of it.
- **Neither baseline would have caught `getReferring`.** A name snapshot says
  nothing about a signature, and that removal is a signature change that answers
  `[]` in silence. Only `pluginFacingSessionApi.test.ts`'s shape — perform the
  call the way a published bundle spells it — catches that class, and it covers
  only bundles someone has read.
- **The type-export surface probably does not earn one.** `LayoutRecord` broke an
  out-of-tree *rebuild*, which is loud, and the in-tree compiler already covers
  it. It earned a changelog line, which it now has.

### v4.3.0's per-view highlight setting is dropped on load

`highlightsVisible` was lifted from a per-view LGV prop (v4.3.0
`plugins/linear-genome-view/src/LinearGenomeView/model.ts:215`,
`types.optional(types.boolean, true)`, persisted as `false` by that model's
`postProcessSnapshot`) and from the GridBookmark widget into one session-wide
`types.stripDefault(types.boolean, true)` at
`packages/product-core/src/Session/BaseSession.ts:118`. There is no entry for it
in `packages/product-core/src/sessionMigrations/index.ts`.

MST ignores a snapshot key it no longer declares — `ModelType.isValidSnapshot`
iterates only `propertyNames` — so a v4.3.0 session saved with `views: [{ …,
highlightsVisible: false }]` loads without complaint and the band the user
dismissed comes back, on every view at once. Not a load failure, and the new
default is the safe direction, which is why this sits below the ABI entry; it is
still a saved session that reopens showing something the user turned off.

**First move: decide whether it earns a migration.** One `sessionMigrations`
entry folding any per-view `false` into the session-level flag is a few lines;
the alternative is to say a highlight band is cheap to re-dismiss and write the
change into the upgrade guide instead, which is where the recombination-lane
removal went.

### Decide whether a track's height should be bounded at all

**The blank this entry used to describe is fixed** (2026-08-22): past
`MAX_CANVAS_DIM_PX` a display now draws at reduced resolution instead of asking
for a viewport its target cannot hold, because `syncCanvasSize` reports the scale
each axis actually got and every rect derives from that.
[reference/ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md) §"A canvas
past `MAX_CANVAS_DIM_PX` renders wrong, not smaller" carries the mechanism and
the verification.

What is left is a judgement nobody has made: **should a drag be bounded by
`maxCanvasCssPx()` anyway?** `TrackHeightMixin`'s `setHeight` / `resizeHeight`
clamp at `MIN_DISPLAY_HEIGHT` and at no maximum, so a track can still be dragged
to any height — it just renders correctly now, at a resolution that falls off
above ~4096 CSS px on a retina panel and ~8192 at dpr 1. Arguments both ways:

- **Bound it.** The resolution falloff is invisible in practice but real, and a
  track taller than two screens is not a thing anyone reads — the handle simply
  stopping is honest and needs no message.
- **Leave it.** The cap is per-axis and dpr-dependent, so the same drag stops at
  different places on different monitors, which is its own confusion. And a flat
  clamp in the shared mixin is the wrong shape for the displays that already
  bound themselves differently: MAF scrolls its overflow into a viewport, and the
  multi-row painting divides the cap across rows.

Not urgent either way now that the failure is graceful. Whoever takes it should
decide per display type, not in `TrackHeightMixin`.

### Pull the byte-gate commit protocol into a pure reducer the fuzzing can reach

`gateTruthTable.test.ts` enumerates the derived getters exhaustively (67,200
rows), but by its own comment it cannot see an action *sequence*: the commit
rules — issued-tier and issued-viewport judging (`commitByteMeasurement`), the
two `clearByteEstimate` triggers, force-load flipping mid-flight — live in
example tests scattered per display. The 2026-08 tier-key fix is exactly the
class a seeded random walk over a `nextGateState(prev, event)` reducer would
have found first (events: measurement-committed, viewport-moved,
chromosome-nav, tier-swap, force-load), the way canvas's
`loadedRegionCoverage.test.ts` already walks zoom/pan.
`setByteEstimate`/`setGateMeasuredViewport`/`clearByteEstimate` become one-line
delegations; nothing observable changes.

### The tier hook's byte budget still resolves off the track's main adapter

`adapterFetchSizeLimit` reads `['adapter','fetchSizeLimit']` off the track
config even when `byteGateAdapterConfig` points the measurement at a
sub-adapter (MAF's summary tier), so a sub-adapter that declared its own limit
would be gated against the wrong number. Inert today — the adapters declaring
the slot are Bam/Cram/VcfTabix/SplitVcfTabix and no in-tree tier swap targets
one — and **not fixable from the snapshot**: a resolved snapshot omits slots at
their schema default (the mixin's own `adapterFetchSizeLimit` note), so the fix
is the tier hook carrying its config *node* or its resolved budget alongside
the snapshot, not a `.fetchSizeLimit` read off what it already returns. A
static check cannot close it either — which adapter type sits behind a
`byteGateAdapterConfig` override is a config-time fact.

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
to `colorNeutralRead` (`#c8c8c8`, `palette.ts:385`) and `colorPairLR`
(`#d3d3d3`, `palette.ts:353`): two greys, not the same grey, and two legend rows
for one thing. Pinned by the last `describe` in
`shaders/overlayPaletteParity.test.ts:142`.

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
match segment `KIND_BASE_TILE`, and the outline gate is "not CIGAR, not marker"
(`isClickedSilhouette` in `syntenyTypes.slang`, mirrored in
`Canvas2DSyntenyRenderer`), which a tile passes. So a clicked feature gets the
side edges of *every* match tile stroked instead of one silhouette — a ribbon
with 300 visible indels draws ~600 black hairlines. The shader comments say the
intent is the clicked feature's BASE silhouette, so this is accidental kind
reuse, not a chosen look.

The kind is no longer the missing piece: `KIND_BASE_TILE` exists, added so the
renderers could fade a tile by its own width, and teaching the edge pass to skip
it is one predicate. What still needs the visual decision first is what a tiled
feature is outlined WITH once it does — skipping the tiles leaves it **no outline
at all**, because pass 1 deliberately lays down no full-span base in that mode
(that is what keeps the indels see-through) — `isTiled` in
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

### A sub-pixel matrix row draws 1px on the GPU and thinner on Canvas2D

`variantMatrix.slang`'s `drawnCellHeightPx` floors a cell at 1px;
`Canvas2DVariantMatrixRenderer` draws `rowHeight + f2` with no floor. On a
2,504-sample matrix at the default height rows are 0.09px, so the GPU paints
each cell 11x taller than Canvas2D does and the SVG export comes out visibly
fainter than the screen it was exported from.

Measured 2026-08-21: giving the Canvas2D path the same floor moves **41.4%** of
the pixels in `VcfMatrix.test.tsx` and 35.4% in `VcfCluster.test.tsx`.

**Neither side is obviously the bug**, which is why this is here. The GPU's
floor is a hardware workaround — zero-height geometry gets culled — and
Canvas2D has no such constraint, so drawing a 0.09px rect and letting
antialiasing carry it is arguably the more faithful answer. But the two
backends then disagree by 41%, and the export disagrees with the screen.

The Canvas2D comment already says **"Do NOT pixel-snap or force a 1px minimum
here (that decimates sub-pixel columns)"** — written about columns, and it is
what makes this a call rather than an edit. Whoever takes it should read
`compare-backends.ts --gate-only` first — the committed webgl goldens are
themselves stale repo-wide, so they are not a tiebreak.

The hit test is already settled and is not waiting on this: `matrixHitTest.ts`
walks the GPU's 1px band, which is a superset of the Canvas2D extent, and
`nearest` is the same row either way.

### Fill the whole display rectangle, not just the hi-C triangle

The display draws the rotated triangle — canvas x is a pair's midpoint, y its
separation — so the two bottom corners are the part of the box its edges never
reach, and `yScalar` (`squashToHeight`) stretches the triangle to the display
height rather than filling that box. What a corner wants is contacts whose far end is off screen:
the point `(x, y)` draws the pair `(x - y, x + y)`, so the deepest corner — left
edge, apex height — asks for data **half a visible span past the edge**, i.e. a
fetch window of 2x the visible span against today's static blocks at ~1.5x.

**Half of it is already happening.** Nothing culls on y —
`Canvas2DHicRenderer`'s cull is the x axis alone ("height is deliberately not
culled: the triangle apex and `yScalar` already bound it"), and the GPU path
lets the rasterizer discard — so every fetched contact landing in the rectangle
is drawn, and the buffered fetch already puts some of the corner population
there. Those are the same contacts measured as vertex cost in
[reference/REJECTED_IDEAS.md](reference/REJECTED_IDEAS.md) §"A finer fetch
quantum for hi-C's buffered static-block fetch": 609,913 against the visible
span's 318,024 at a 50 Mb span on a deep map, which is vsync on WebGPU and
27 ms — 60 fps to ~37 while panning — on the WebGL2 rung. That is the closest
thing to a price tag this idea has, and it makes that entry's parked lever (a
*smaller* fetch quantum) the opposite direction: emptying the corners is the one
thing the fill cannot afford, so whichever is built kills the other.

**The call is what y means once the apex stops bounding it.** Fit-to-height ties
the apex to the visible span, so under a fill whole-chr1 asks for contacts
125 Mb apart — separations the file barely holds, at a binsize where the corners
come back empty anyway. The alternative is a max-separation knob, the shape a
horizontal hi-C track usually has: height means a fixed bp distance, the fetched
matrix is a diagonal band rather than a square, and the drawn count is bounded
by width x that distance instead of by span squared. Decide that before any of
it, because it decides the fetch shape.

Two things move with whichever way it goes: that y cull has to become real, and
`hicTransform`'s inverse is what keeps the hit test honest at the corners, so
both directions want a case in `hicTransform.test.ts`.

## Measure first: the premise or the cost attribution is unconfirmed

Every entry here opens with a measurement because the obvious build would be
guessing. The instrumentation pattern for the render-path ones is
[reference/PERF_INSTRUMENTATION.md](reference/PERF_INSTRUMENTATION.md).

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
  which is the likely explanation for the `WeakRef` measurement in
  [ADR-069](architecture-decision-records/adr-069-detach-do-not-destroy-what-react-may-hold.md),
  under "It does not promise prompt collection either": a superseded root still
  resolving after a forced gc, including one that had been `destroy`ed. That was
  logged as unexplained; this is the candidate.

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

`WebWorkerRpcDriver` sizes its pool `clamp(detectHardwareConcurrency() - 1, 1,
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
`components/overlayElements.tsx` (`useOverlayElements.tsx` until `e148172a5e`
made its pseudo-hooks the observer components `FloatingLabelsLayer` and
`HighlightLayer`), `yMorph.ts` (`interpolateYData`, `captureFeatureTops`) and
`scaleLaidOutData` all read absolute `topPx`/`bottomPx`/`rectYs` today.
`renderSvg.tsx` no longer does — it hands `laidOutDataMap` to the Canvas2D
helpers — so the census is one consumer shorter than this entry counted. Count
those call sites first and decide whether they can share one "resolve Y"
accessor, or whether enough of them need the offset folded in that the clone
comes straight back — that answer decides whether the spike is worth it at all.

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
little of it: `HighlightLayer` does a handful of `.get()`s (and genuinely needs
`entry.vr` / `entry.data`), while `FloatingLabelsLayer` asks twice — the
`?.kind === 'feature'` check at `components/overlayElements.tsx:467`, which
decides whether a label is clickable, and `resolveTarget` at `:521-531`.

Only the first of the two is removable. `emitSubfeatureLabel` always sets
`parentFeatureId` and `processFeatureRecord` never does, so
`clickable === (labelData.parentFeatureId === undefined)` with no map at all.
`resolveTarget` is not that: it returns `entry.item` to the click, context-menu
and mousemove handlers, which a `parentFeatureId` cannot supply, and it predates
this entry (`8a3a06cbb8`) — the claim that the second consumer went outright was
wrong on arrival.

So the map stays and what is open is what it costs: replace it with an on-demand
region scan or a lazily-populated per-id cache, and fold in `baseModel.ts`'s
`featureIdIndex` / `subfeatureIdIndex` (`:1678-1687`), which build two
neighbouring id indexes the same way.

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
in no other file — returns **hundreds of names** (623 when this was written, ~741
from a crude equivalent today, so read the size as indicative and not as a
figure), and spot-checking says almost none of them are dead:

- Most are exported *types* of published packages. `@jbrowse/core` and every
  `@jbrowse/plugin-*` ship to npm, so a type nobody imports in-tree is API, and
  removing it is an ABI break — see
  [reference/PLUGIN_ABI_STABILITY.md](reference/PLUGIN_ABI_STABILITY.md).
- The examples-sites' components are consumed by Astro. A scanner that reads
  only `.ts`/`.tsx` never sees a `.astro` importer, and under `jsx: react-jsx`
  it never sees `react/jsx-runtime` either — the same blind spot that made
  `astro` and `react` read as dead dependencies in `f783f4444c`'s first pass.
- `_AssertAddSessionTrack` / `_AssertPublishTrackConf`
  (`createSessionModel.ts:102,106`, which `f1a0a46316` split out of the single
  `_AssertAddTracks` this used to name), `AssertEnumListsCoverUpstream` and
  friends are compile-time assertions. Appearing once is what they are for.

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
