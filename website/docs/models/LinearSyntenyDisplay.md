---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
description: "Pure-data model. The containing LinearSyntenyView owns the shared GPU backend, the upload autorun (which watches every display's instanceData and keys it by displayKey), and the render autorun.…"
sidebar_label: Display -> LinearSyntenyDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts).

## Example usage

A complete `SyntenyTrack` config to paste into `tracks`. The adapter needs
the query (first) and target (second) assembly names, matched by the track's
`assemblyNames`:

```js
{
  type: 'SyntenyTrack',
  trackId: 'hg38_vs_mm10',
  name: 'hg38 vs mm10',
  assemblyNames: ['hg38', 'mm10'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/hg38_vs_mm10.paf',
    queryAssembly: 'hg38',
    targetAssembly: 'mm10',
  },
  displays: [
    {
      type: 'LinearSyntenyDisplay',
      displayId: 'hg38_vs_mm10-LinearSyntenyDisplay',
    },
  ],
}
```

Pure-data model. The containing LinearSyntenyView owns the shared GPU
backend, the upload autorun (which watches every display's `instanceData`
and keys it by `displayKey`), and the render autorun. This display only
carries per-track state and the `renderParams` the view reads out.

The configuration slots for this model are documented on its [config schema page](../../config/linearsyntenydisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('LinearSyntenyDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |
| <span id="property-hiddenfeatureids">**hiddenFeatureIds**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hiddenFeatureIds: types.stripDefault(types.array(types.string),…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hiddenFeatureIds: types.stripDefault(types.array(types.string), [])</code></pre></dialog></span> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-featuredata">**featureData**</span><br><code>SyntenyFeatureData &#124; undefined</code> |  |
| <span id="volatile-instancedata">**instanceData**</span><br><code>SyntenyGeometry &#124; undefined</code> | Raw GPU-instance geometry produced by the RPC. The view observes this on every display and uploads it to the shared backend keyed by `displayKey`. Clearing it (undefined) triggers backend eviction. |
| <span id="volatile-geometryregionsignature">**geometryRegionSignature**</span><br><code>string &#124; undefined</code> | The `regionSignature` the fetch behind `instanceData` was laid out under. Ribbon corners and mate marks are placed in that layout's cumBp space, so they draw only while the rows still show it (`geometryCurrent`); the feature lanes name loci in bp and stay usable either way. |
| <span id="volatile-hoveredinstanceidx">**hoveredInstanceIdx**</span><br><code>number</code> | Index into `instanceData` of the GPU instance the pointer is over, or -1. The INSTANCE, not the feature, even though the tooltip and the highlight are both about the feature: a CIGAR-detailed ribbon is a base block plus a tile per indel, and the operator under the cursor is readable from nothing else (`getCigarOpAtInstance`). `getFeature` translates to the feature. Same choice `DotplotDisplay` makes, where the stored index is `hoveredSegmentIdx`. |
| <span id="volatile-clickedfeatureuniqueid">**clickedFeatureUniqueId**</span><br><code>string &#124; undefined</code> | Clicked twin of `hoveredInstanceIdx`, held as the adapter's own feature id rather than an offset: the click opens the details drawer, which resizes the view and refetches, and an offset cannot survive that. |
| <span id="volatile-contextmenuanchor">**contextMenuAnchor**</span><br><code>ClickCoord &#124; undefined</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span></span>

<span data-pagefind-ignore>From [ComparativeFetchMixin](../comparativefetchmixin): <span id="volatile-assembliesswapped">[`assembliesSwapped`](../comparativefetchmixin#volatile-assembliesswapped)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="volatile-loadedfetchkey">[`loadedFetchKey`](../keyedfetchmixin#volatile-loadedfetchkey)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span></span>

<span data-pagefind-ignore>From [LodTierInfoMixin](../lodtierinfomixin): <span id="volatile-adapterheaderread">[`adapterHeaderRead`](../lodtierinfomixin#volatile-adapterheaderread)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-parenthelper">**parentHelper**</span><br><code>LevelDuck</code> | The level (row gap) this display's track sits on. Found by predicate rather than by hop count — see isSyntenyLevel. |
| <span id="getter-level">**level**</span><br><code>number</code> | Index of the level (row gap) this display draws in. |
| <span id="getter-displaykey">**displayKey**</span><br><code>number</code> | Stable backend key under the view-shared backend. |
| <span id="getter-height">**height**</span><br><code>number</code> |  |
| <span id="getter-numfeats">**numFeats**</span><br><code>number</code> |  |
| <span id="getter-culledribbonmates">**culledRibbonMates**</span><br><code>CulledRibbonMates &#124; undefined</code> | Every alignment this display drew geometry for, placed on both axes, so either strip can mark the ones the band is currently culling. One per row, since culling is symmetric. Lazy by construction: with the marks off nothing observes it. Both perspectives are one walk; whether the lower row's is drawn is `laneData`'s question. With any ribbon hidden it reads the colours too, so a hidden ribbon leaves no mark. |
| <span id="getter-cappedmeanalignmentpx">**cappedMeanAlignmentPx**</span><br><code>number</code> | Mean on-screen width (px, axis 0) of this display's alignment blocks with every already-wide block counted as `FADE_WIDE_BLOCK_PX`, or 0 until a fetch lands and both views connect. The fade only affects sub-pixel ribbons (perpW < 1), so a capped mean well under 1 means the view is dominated by thin ribbons — exactly what width-proportional fade declutters, and `LinearSyntenyView.fadeThinAlignments` decides 'auto' off the narrowest of these.<br><br>O(numFeats) per zoom rather than per fetch, because the cap is a px width: 4.2 ms over a million-block whole-genome PAF, where the answer is nowhere near the threshold anyway, and 0.4 ms at a hundred thousand. |
| <span id="getter-presentcigarkinds">**presentCigarKinds**</span><br><code>number</code> | Which CIGAR indel ops are actually painted in the current geometry. The worker only emits an indel instance for an op wide enough to draw (sub-pixel indels are dropped), so a set bit means a visible-width op of that kind is on screen. The legend keys its indel chips off this rather than the coarse "file has any CIGAR" flag, so whole-genome zoom (every indel sub-pixel) shows no dead insertion/deletion swatch. |
| <span id="getter-warnings">**warnings**</span><br><code>ComparativeWarning[]</code> | Warnings surfaced in the view header. Flags a likely reversed assembly row order, detected once at view load (only when the two assemblies have distinct chromosome names). |
| <span id="getter-fetchlanded">**fetchLanded**</span><br><code>boolean</code> | `ComparativeFetchMixin`'s hook: a fetch has completed (data is present, even if it mapped zero features). Not `numFeats > 0` — an empty-but-finished fetch has landed, otherwise an empty result spins the loading overlay forever. |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | Overrides `FetchMixin`'s default-false hook with the two states where this display's fetch autorun deliberately never runs: minimized, or a level whose two rows aren't both showing regions. A display in one of them draws nothing (`renderParams` is undefined for exactly the same pair) and has no data coming, so anything waiting on data has to treat it as terminal rather than wait forever. One getter because four places answer it — the autorun's own gate, the loading overlay, the SVG export, and (through the mixin) `displaysSettled`. |
| <span id="getter-regionsignature">**regionSignature**</span><br><code>string</code> | Contents, order and orientation of both connected views' displayed regions — the inputs the worker's cumBp index is built from, so a change in any of them makes held features stale. Its own getter, not inlined into `currentFetchKey`: this is O(total regions) (a whole-genome view of a scaffold-heavy assembly runs to thousands), while `currentFetchKey`'s other deps flip on every pan past the buffer and every zoom bucket. Split out, MobX memoizes it against `displayedRegions` alone instead of rebuilding the whole string per zoom step. |
| <span id="getter-geometrycurrent">**geometryCurrent**</span><br><code>boolean</code> | The held geometry was laid out under the regions the rows show now. A flip, a mate-mark drop or the follow's locstring fallback rewrites the regions ahead of the refetch, and one blank frame is honest where a ribbon at a locus that no longer exists is not. |
| <span id="getter-matemarks">**mateMarks**</span><br><code>SyntenyFeatureData &#124; undefined</code> | the payload's off-screen mate marks while `geometryCurrent`, which is what the strip places them against |
| <span id="getter-viewsignature">**viewSignature**</span><br><code>string</code> | `KeyedFetchMixin`'s hook, this display's half of `currentFetchKey`: the fetch-input signature (region set/order, snapped fetch window, zoom bucket, CIGAR draw options, LOD tier) for the view's current state — the same tracked deps the fetch autorun refetches on. The mixin appends the settings and adapter axes. Reactive: flips the instant any of them changes. Before both connected views are ready it collapses to a degenerate signature (empty region sig, no fetch-window/zoom keys) that no connected fetch can produce — a real fetch requires non-empty displayedRegions — so `dataCurrent` reads false until a real fetch lands. Non-nullable so it mirrors dotplot's. |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayStatusPhase</code> | The display's own mutually-exclusive state, the way every LGV display publishes one — so `AppReadyMarker` counts this display's fetch, and the app stops reporting itself ready over a ribbon that is still working. Ranked by `comparativeDisplayPhase`, off the shared canvas's `surfaceReadiness` and this display's own fetch state.<br><br>`DisplayStatusPhase`, not `DisplayPhase`: the level owns the rendering backend, so this display can never be the one to report a backend failure. |
| <span id="getter-view">**view**</span><br><code>ParentViewDuck</code> | The LinearSyntenyView this display's level sits in. Duck-typed, and that is the load-bearing part: this getter is the last edge of the view -> level -> display -> view cycle, and naming the view's model here is what made `levels` an `IAnyModelType` and every read off a level `any`. `parentViewDuck.ts` carries the rest, including why ADR-055's interface form does not substitute on a four-node loop. |
| <span id="getter-hiddenfeatureidx">**hiddenFeatureIdx**</span><br><code>ReadonlySet&lt;number&gt;</code> |  |
| <span id="getter-computedcolors">**computedColors**</span><br><code>Uint32Array&lt;ArrayBuffer&gt; &#124; undefined</code> | Main-thread-computed per-instance colors. Recomputes whenever the view's `color`, featureData, or instanceData descriptors change — this is the gpuProps half of the rpcProps/gpuProps split. Colour changes flow through here without touching the RPC.<br><br>`drawLocationMarkers` goes through the same color lane, so it stays out of `currentFetchKey`. The worker always emits the ticks, and a zero alpha here turns them off, so the toggle costs one color-lane patch (`SYNTENY_INSTANCE_CACHE`) and no refetch of the track. |
| <span id="getter-groundcolor">**groundColor**</span><br><code>string</code> | The band this display paints into — see `bandGroundColor`. Read here as well as on the level because the location ticks are packed into the color lane, which is this display's, and the SVG export draws through `renderSvg` without a level to ask. |
| <span id="getter-paintedrefnameposition">**paintedRefNamePosition**</span><br><code>RefNamePosition &#124; undefined</code> | Where a refName sits in whichever of this level's two assemblies `paintedField` resolved to — `Assembly.getRefNamePosition`, alias-aware — which the chromosome-painting modes hand the palette out by. Undefined for every other mode, and while the assembly is still loading — the color function falls back to its hash there.<br><br>It has to come from the assembly rather than from the features, because a color must not change with which chromosomes happen to be in view. |
| <span id="getter-trackid">**trackId**</span><br><code>string</code> |  |
| <span id="getter-trackcolor">**trackColor**</span><br><code>string</code> | This track's slot in the view's palette, used by the `track` field. Assigned by the view, not locally: pinning a color on one track shifts which automatic slots its siblings can take. |
| <span id="getter-colorfield">**colorField**</span><br><code>string</code> | The field the view paints by, before the per-level 'reference' remap. This is the user-facing answer — the legend title reads it, so a 'reference' view reports 'reference' rather than the query/target each level resolved it to. |
| <span id="getter-paintedfield">**paintedField**</span><br><code>string</code> | `colorField` resolved for this specific level, for the renderer. 'reference' colors every level by the shared anchor assembly's chromosome names; each level maps it to 'query' or 'target' depending on which of its two assemblies is the anchor, so the coloring stays consistent across levels. Every other field passes through.<br><br>A level touching NEITHER anchor side (the C-D level of an A-B-C-D stack anchored on B) falls through to 'query': it cannot color by an assembly it does not draw, so the cross-level color continuity stops at that level while the legend still reads "reference". |
| <span id="getter-renderinstancedata">**renderInstanceData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ colors: Uint32Array&lt;ArrayBuffer&gt;; bp1: Float32Array&lt;ArrayBuff…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ colors: Uint32Array&lt;ArrayBuffer&gt;; bp1: Float32Array&lt;ArrayBufferLike&gt;; bp2: Float32Array&lt;ArrayBufferLike&gt;; bp3: Float32Array&lt;ArrayBufferLike&gt;; bp4: Float32Array&lt;ArrayBufferLike&gt;; base0: number; base1: number; kinds: Uint8Array&lt;ArrayBufferLike&gt;; instanceFeatureIdx: Uint32Array&lt;ArrayBufferLike&gt;; alignmentLengths: Float32Array&lt;ArrayBufferLike&gt;; instanceCount: number; } &#124; undefined</code></pre></dialog></span> | Instance data with main-thread-computed colors substituted in. The view's upload autorun reads this, so any colour change re-fires upload without an RPC round-trip. |
| <span id="getter-tooltiplines">**tooltipLines**</span><br><code>string[] &#124; undefined</code> | The hovered ribbon's tooltip, as lines, or undefined when nothing is hovered. Lines rather than an HTML string — see `getTooltipLines`, and `DotplotDisplay.tooltipLines` for the twin. |
| <span id="getter-connectedviews">**connectedViews**</span><br><code>RowPair &#124; undefined</code> | the level's `connectedRows` |
| <span id="getter-bpperpxbucketkey">**bpPerPxBucketKey**</span><br><code>string &#124; undefined</code> | Stable key over the log2 zoom bucket of both connected views. The fetch autorun tracks this (a computed compares its string output) instead of raw bpPerPx, so it only refetches when zoom crosses a doubling rather than on every settled zoom within a bucket. |
| <span id="getter-lodtier">**lodTier**</span><br><code>LodTier</code> | The detail tier this level's fetch asks the adapter for, resolved here on the main thread so it can enter `currentFetchKey`.<br><br>It cannot be resolved adapter-side from `bpPerPx`: the refetch key carries only `bpPerPxBucketKey`, a log2 bucket, and the default 10000 threshold sits *inside* bucket 13 (8192..16384). Zooming across the threshold within one bucket therefore changed nothing the key could see, and the view kept drawing the coarse tier's gap-free ribbons while reporting itself current.<br><br>The zoom fed in is `min` of both axes, because CIGAR detail is worth drawing when the band is wide on EITHER axis — buildSyntenyGeometry's MIN_CIGAR_PX_WIDTH gate uses `max(widthPx0, widthPx1)` — so dropping to coarse is only safe once BOTH axes are past the threshold. Taking the query axis alone lost indel detail on a band whose query was zoomed out but whose target was zoomed in.<br><br>The tier the adapter will serve, once `lodTierInfo` has landed: a file with no coarse tier is 'fine' at any zoom, and the threshold is clamped up to the file's `--coarse` bound. |
| <span id="getter-coarsewalkisapproximate">**coarseWalkIsApproximate**</span><br><code>boolean</code> | True while the served tier is the coarse one and the zoom is finer than the fold's `--coarse` bound, which only a pinned "Alignment blocks only" reaches. A walk through a coarse CIGAR is within that bound of the alignment's real path, and the bound is sub-pixel at or past it and visible below it, so the follow reports a placement walked there as approximate. |
| <span id="getter-fetchregions">**fetchRegions**</span><br><code>Region[]</code> | The query axis's (v0) fetch window, and the regions the fetch actually sends: the visible content blocks expanded by the shared pan buffer and snapped outward to a buffer-sized grid, so a pan within the buffer neither refetches nor exposes an unfetched strip. The worker emits geometry for exactly this window, so the two cannot disagree. The target axis is not scoped — the fetch is one-dimensional (query regions in, every mate out) — so its window is `targetWindowRegions`. |
| <span id="getter-targetwindowregions">**targetWindowRegions**</span><br><code>Region[]</code> | The target axis's (v1) snapped window: what the LOWER row can pan across before the fetch key rolls over, in the key and sent to the worker either way, because `buildSyntenyGeometry` emits detail for it exactly as it does for the query window. What the bidirectional setting decides is only whether the worker also QUERIES it, recovering the alignments anchored there whose query end is on a contig the row above is not displaying.<br><br>THE EMIT, not the projection: corners are stored base-relative and the `panPx` uniforms compensate a pan at draw time, which is the whole reason panning does not inherently need a refetch. And "the lower row" rather than `v1`, which the worker spells the other way round — `executeSyntenyFeaturesAndPositions` binds `v1 = queryView`. |
| <span id="getter-fetchregionskey">**fetchRegionsKey**</span><br><code>string &#124; undefined</code> | Stable key over the *snapped* fetch window of both connected views. The fetch autorun tracks this (through `currentFetchKey`) so a scroll/zoom that moves either snapped window refetches, while a sub-buffer pan (identical snapped windows) does not — a MobX computed only notifies when its string output changes. Built from the same `fetchRegions` the worker is handed, so the key can't describe a window the fetch didn't use. |
| <span id="getter-hoveredfeatureid">**hoveredFeatureId**</span><br><code>number</code> | The hovered instance as a 1-based featureId (0 = "no hit"), the id the shaders and the painter compare against. Matches the `instanceFeatureIdx[i] + 1` mapping in interleaveInstances and the pick engine. |
| <span id="getter-clickedfeatureid">**clickedFeatureId**</span><br><code>number</code> | The clicked twin, re-resolved from the stored name; a payload that dropped the feature answers 0. Its own computed rather than a field of `renderParams`, which moves on every pan frame — the outline cell is keyed on this, so that would re-upload it per pointermove. |
| <span id="getter-renderparams">**renderParams**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ yTop: number; height: number; alpha: number; fadeThinAlignmen…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ yTop: number; height: number; alpha: number; fadeThinAlignments: boolean; minAlignmentLength: number; hoveredFeatureId: number; clickedFeatureId: number; offsetPx0: number; offsetPx1: number; bpPerPx0: number; bpPerPx1: number; drawCurves: boolean; } &#124; undefined</code></pre></dialog></span> | Per-track render params consumed by the view's aggregator. yTop is 0 here: the level's canvas is the band, and only the multiway display stacks tracks within one. |
| <span id="getter-outlinekey">**outlineKey**</span><br><code>number</code> | Stable key for this display's outline cell, beside the `displayKey` its ribbons upload under. Two cells rather than one so a click re-uploads the handful of records the outline traces instead of the track's whole buffer — hashed off a name of its own for the same reason `displayKey` is hashed rather than indexed. |
| <span id="getter-ribboncell">**ribbonCell**</span><br><code>SyntenyCell &#124; undefined</code> | This display's ribbons as the band's backend holds them. Built here rather than in the level's map so the wrapper's identity is this display's: a sibling's refetch rebuilds that map, and a fresh wrapper per entry would re-upload every track on it. |
| <span id="getter-outlinecell">**outlineCell**</span><br><code>SyntenyCell &#124; undefined</code> | The clicked ribbon's outline cell, or nothing while no ribbon is selected. Its identity changes on a selection, a refetch and a recolor, which is when the packed bytes it copies out stop describing it. A pan or a hover leaves it unchanged, because `clickedFeatureId` is a separate computed. |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span></span>

<span data-pagefind-ignore>From [ComparativeFetchMixin](../comparativefetchmixin): <span id="getter-hasdrawable">[`hasDrawable`](../comparativefetchmixin#getter-hasdrawable)</span>, <span id="getter-loading">[`loading`](../comparativefetchmixin#getter-loading)</span>, <span id="getter-refetching">[`refetching`](../comparativefetchmixin#getter-refetching)</span>, <span id="getter-svgready">[`svgReady`](../comparativefetchmixin#getter-svgready)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="getter-datasuperseded">[`dataSuperseded`](../keyedfetchmixin#getter-datasuperseded)</span>, <span id="getter-currentfetchkey">[`currentFetchKey`](../keyedfetchmixin#getter-currentfetchkey)</span>, <span id="getter-datacurrent">[`dataCurrent`](../keyedfetchmixin#getter-datacurrent)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span></span>

<span data-pagefind-ignore>From [LodTierInfoMixin](../lodtierinfomixin): <span id="getter-adapterheader">[`adapterHeader`](../lodtierinfomixin#getter-adapterheader)</span>, <span id="getter-lodtierinfo">[`lodTierInfo`](../lodtierinfomixin#getter-lodtierinfo)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-getfeature">**getFeature**</span><br><code>(index: number) =&gt; FeatPos &#124; undefined</code> | The parent feature under an INSTANCE index, what the pick engine and the hover and click state carry; `getFeatureAtIndex` takes a feature index |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-trackmenuitems">[`trackMenuItems`](../basedisplay#method-trackmenuitems)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setrpcdata">**setRpcData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(featureData: SyntenyFeatureData &#124; undefined, instanceData: Syn…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(featureData: SyntenyFeatureData &#124; undefined, instanceData: SyntenyGeometry &#124; undefined, regionSignature: string) =&gt; void</code></pre></dialog></span> | Set both feature and instance data in one MST action so downstream autoruns (upload, render) fire once per RPC completion, not twice.<br><br>The hover index and the context menu both describe the fetch being replaced and are dropped. The clicked feature is not: it is a name, and `clickedFeatureId` re-resolves it against whatever landed. |
| <span id="action-hidefeature">**hideFeature**</span><br><code>(featureId: string) =&gt; void</code> |  |
| <span id="action-showallhidden">**showAllHidden**</span><br><code>() =&gt; void</code> |  |
| <span id="action-sethoveredinstanceidx">**setHoveredInstanceIdx**</span><br><code>(idx: number) =&gt; void</code> | Point the hover at one GPU instance, or -1 for none. The level's `setHoveredFeature` is what calls this, from a pick hit. |
| <span id="action-setclickedinstance">**setClickedInstance**</span><br><code>(idx: number) =&gt; void</code> | Point the click at one GPU instance, or -1 for none. Stores the feature behind it, not the index. |
| <span id="action-opencontextmenu">**openContextMenu**</span><br><code>(anchor: ClickCoord) =&gt; void</code> |  |
| <span id="action-closecontextmenu">**closeContextMenu**</span><br><code>() =&gt; void</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-reload">[`reload`](../basedisplay#action-reload)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span></span>

<span data-pagefind-ignore>From [ComparativeFetchMixin](../comparativefetchmixin): <span id="action-setassembliesswapped">[`setAssembliesSwapped`](../comparativefetchmixin#action-setassembliesswapped)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="action-commitfetchresult">[`commitFetchResult`](../keyedfetchmixin#action-commitfetchresult)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span></span>

<span data-pagefind-ignore>From [LodTierInfoMixin](../lodtierinfomixin): <span id="action-setadapterheader">[`setAdapterHeader`](../lodtierinfomixin#action-setadapterheader)</span></span>
