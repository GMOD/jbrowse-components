---
id: wigglecommonmixin
title: WiggleCommonMixin
sidebar_label: Mixin -> WiggleCommonMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`wiggle` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleCommonMixin.ts).

Extends WiggleScoreConfigMixin with rpcDataMap, autoscale domain, and cache
reset — plus the wiggle-specific config that used to sit in that mixin (the
pos/neg palette, rendering type, summary mode, resolution and the line/gap
settings). They live here because this is where they are _read_: the other
composer of WiggleScoreConfigMixin, LinearManhattanDisplay, touches none of them
and was inheriting a config schema advertising them anyway. Moved onto this
chain with `.props()`/`.views()` rather than a new mixin composed in, so no
`types.compose` layer is added (ADR-041).

Used by LinearWiggleDisplay and MultiLinearWiggleDisplay. Displays that own a
different rpcDataMap type should compose WiggleScoreConfigMixin directly.

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-resolution">**resolution**</span><br><code>resolution: types.stripDefault(types.number, 1)</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-rpcdatamap">**rpcDataMap**</span><br><code>rpcDataMap: regionDataMap&lt;WiggleDataResult&gt;('rpcDataMap')</code> |  |
| <span id="volatile-hoveredwigglefeature">**hoveredWiggleFeature**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hoveredWiggleFeature: undefined as WiggleHoveredFeature &#124; undef…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hoveredWiggleFeature: undefined as WiggleHoveredFeature &#124; undefined</code></pre></dialog></span> | The stored hit. Named apart from the `hoveredFeature` getter below it fills, because `BaseDisplay` declares that hook as a computed and MST refuses to instantiate a volatile over one — a display filling it stores under its own name and exposes a getter, which is what canvas, alignments and the variant displays already did. |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-hoveredfeature">**hoveredFeature**</span><br><code>WiggleHoveredFeature &#124; undefined</code> | Fills `BaseDisplay`'s cross-display hover hook. | WiggleCommonMixin |
| <span id="getter-regionfetchkey">**regionFetchKey**</span><br><code>string</code> | Strict zoom equality (adr-008): the worker bins scores to the requested bpPerPx, so data fetched at another zoom is the wrong summary, however well the viewport still sits inside it.<br><br>On this mixin, not the score-config one below it: the rule is about what a fetch returns, and `LinearManhattanDisplay` composes that mixin for the score axis while fetching untransformed SNPs. | WiggleCommonMixin |
| <span id="getter-poscolor">**posColor**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-negcolor">**negColor**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-bicolorpivot">**bicolorPivot**</span><br><code>number</code> |  | WiggleCommonMixin |
| <span id="getter-numquantile">**numQuantile**</span><br><code>number</code> |  | WiggleCommonMixin |
| <span id="getter-linewidth">**lineWidth**</span><br><code>number</code> |  | WiggleCommonMixin |
| <span id="getter-maxgapmultiple">**maxGapMultiple**</span><br><code>number</code> | Interpolated-line gap threshold, as a multiple of the track's own mean point spacing (see gapBreakLimit). 0 keeps one connected line. | WiggleCommonMixin |
| <span id="getter-summaryscoremode">**summaryScoreMode**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-renderingtype">**renderingType**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-minimalticks">**minimalTicks**</span><br><code>boolean</code> |  | WiggleCommonMixin |
| <span id="getter-hasresolution">**hasResolution**</span><br><code>boolean</code> |  | WiggleCommonMixin |
| <span id="getter-effectivesummaryscoremode">**effectiveSummaryScoreMode**</span><br><code>string</code> | The summary mode actually drawn. Density has no whiskers presentation — `sourceLayers` falls back to the average scores — so the autoscale domain reads this rather than the raw slot; otherwise the color ramp spans the whisker extremes while the plot paints averages, and the score legend reports a range nothing on screen reaches. Single-wiggle defaults to whiskers, so plain "plot type → Density" hit this. | WiggleCommonMixin |
| <span id="getter-autoscalesourcenames">**autoscaleSourceNames**</span><br><code>Set&lt;string&gt; &#124; undefined</code> | Source names to include when computing the autoscale domain; `undefined` means every fetched source. Multi-wiggle always fetches all sources and filters client-side, so it overrides this to the visible subset — otherwise a subtree filter that hides sources would leave the Y-axis scaled to the hidden ones. | WiggleCommonMixin |
| <span id="getter-scorerulevalues">**scoreRuleValues**</span><br><code>number[]</code> | Scores the axis must reach whatever the data does, so a rule drawn at one stays on it. `[]` here and overridden by the displays that draw score rules — MultiLinearWiggleDisplay stacks a plot box per row and draws none, so it keeps the base. | WiggleCommonMixin |
| <span id="getter-domain">**domain**</span><br><code>[number, number] &#124; undefined</code> | The autoscaled domain over the sources visible in the settled blocks. `undefined` until the view and the data are ready, which is not the `[0, 1]` a caller falls back to — see `visibleStatsDomain`. | WiggleCommonMixin |
| <span id="getter-symlogconstant">**symlogConstant**</span><br><code>number</code> | <span data-pagefind-ignore>Raw `symlogConstant` slot; `0` means "derive from the domain". Lives here rather than on `ScoreScaleMixin` because the slot does: only the wiggle shaders implement symlog, and the alignments coverage band composes that mixin against a config schema that never declares it. Resolve it with `resolveSymlogConstant` once the domain is known.</span> | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-symlogconstant) |
| <span id="getter-scatterpointsize">**scatterPointSize**</span><br><code>number</code> |  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-scatterpointsize) |
| <span id="getter-displaycrosshatches">**displayCrossHatches**</span><br><code>boolean</code> | <span data-pagefind-ignore>The configured cross-hatch setting. A config slot rather than a display prop — like `scatterPointSize` beside it — because a prop cannot be set from a config at all: MST drops a snapshot key the schema never declares, so `demos/cgiab` had asked for hatches on its CNV track and never got them. Read `showCrossHatches` below for what actually draws; this is the raw setting the menu toggles.</span> | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-displaycrosshatches) |
| <span id="getter-isdensitymode">**isDensityMode**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether score maps to color instead of height. Each display overrides this from its own rendering-type table (`density` / `multirowdensity`); the base is false so this mixin's resolved getters below can key on it, the same override idiom `autoscaleSourceNames` uses in WiggleCommonMixin.</span> | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-isdensitymode) |
| <span id="getter-showcrosshatches">**showCrossHatches**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the score-axis cross hatches draw. Density spends color, not height, on the score, so there is no axis for them to rule — and the track menu drops the toggle there, which would strand hatches enabled in another plot type with no way to turn them off. Every consumer (on-screen overlay, multi-row overlay lines, SVG export) reads this, never the raw `displayCrossHatches` setting.</span> | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-showcrosshatches) |
| <span id="getter-scaletype">**scaleType**</span><br><code>string</code> |  | [ScoreScaleMixin](../scorescalemixin#getter-scaletype) |
| <span id="getter-autoscaletype">**autoscaleType**</span><br><code>string</code> |  | [ScoreScaleMixin](../scorescalemixin#getter-autoscaletype) |
| <span id="getter-numstddev">**numStdDev**</span><br><code>number</code> |  | [ScoreScaleMixin](../scorescalemixin#getter-numstddev) |
| <span id="getter-minscore">**minScore**</span><br><code>number</code> | <span data-pagefind-ignore>Raw slot value, sentinel intact — see the class comment.</span> | [ScoreScaleMixin](../scorescalemixin#getter-minscore) |
| <span id="getter-maxscore">**maxScore**</span><br><code>number</code> | <span data-pagefind-ignore>Raw slot value, sentinel intact — see the class comment.</span> | [ScoreScaleMixin](../scorescalemixin#getter-maxscore) |
| <span id="getter-defaultscoredomain">**defaultScoreDomain**</span><br><code>[number &#124; undefined, number &#124; undefined]</code> | <span data-pagefind-ignore>Overridable hook: what each end of the domain falls back to where the config leaves its bound unset. `[undefined, undefined]` — the default — means autoscale both ends, which is right for a track whose scores have no absolute meaning (a bigwig's units are its own).<br><br>A display whose scores are bounded *by construction* overrides it, so the axis stops being a function of what happens to be on screen: GC content is a fraction, so 0 and 1 are its real limits and mean the same thing at every locus. Autoscaled, the same GC value drew at different heights depending on where the user had panned, and the track could not be read across loci.<br><br>A hook rather than a config default because the answer can depend on display state — GC's does, on `gcMode` — and rather than each display re-resolving the sentinels below, which is the one thing that must not be duplicated: config bounds still win, precisely because they are checked before this is consulted.</span> | [ScoreScaleMixin](../scorescalemixin#getter-defaultscoredomain) |
| <span id="getter-minscorebound">**minScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved lower bound; `undefined` means autoscale this end.</span> | [ScoreScaleMixin](../scorescalemixin#getter-minscorebound) |
| <span id="getter-maxscorebound">**maxScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved upper bound; `undefined` means autoscale this end.</span> | [ScoreScaleMixin](../scorescalemixin#getter-maxscorebound) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-cleardisplayspecificdata">**clearDisplaySpecificData**</span><br><code>() =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setrpcdata">**setRpcData**</span><br><code>(displayedRegionIndex: number, data: WiggleDataResult) =&gt; void</code> | The store half of both displays' `fetchNeeded`. Everything either one derives from a fetch — multi-wiggle's row list included — is a getter over this map, so there is nothing else for a result to update. | WiggleCommonMixin |
| <span id="action-sethoveredfeature">**setHoveredFeature**</span><br><code>(feat?: WiggleHoveredFeature &#124; undefined) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-selectfeature">**selectFeature**</span><br><code>(feat: WiggleHoveredFeature) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setresolution">**setResolution**</span><br><code>(res: number) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setbicolorpivot">**setBicolorPivot**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setposcolor">**setPosColor**</span><br><code>(color?: string &#124; undefined) =&gt; void</code> | Lives here beside the `posColor`/`negColor` getters and `setBicolorPivot` so both the single- and multi-wiggle color editors write the score-sign palette the same way. | WiggleCommonMixin |
| <span id="action-setnegcolor">**setNegColor**</span><br><code>(color?: string &#124; undefined) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setrenderingtype">**setRenderingType**</span><br><code>(type: string) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setsummaryscoremode">**setSummaryScoreMode**</span><br><code>(val: string) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setlinewidth">**setLineWidth**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-clearhoveredfeature">**clearHoveredFeature**</span><br><code>() =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-togglecrosshatches">**toggleCrossHatches**</span><br><code>() =&gt; void</code> |  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#action-togglecrosshatches) |
| <span id="action-setscatterpointsize">**setScatterPointSize**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#action-setscatterpointsize) |
| <span id="action-setscaletype">**setScaleType**</span><br><code>(scaleType: string) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setscaletype) |
| <span id="action-setautoscale">**setAutoscale**</span><br><code>(val?: string &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setautoscale) |
| <span id="action-setminscore">**setMinScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setminscore) |
| <span id="action-setmaxscore">**setMaxScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setmaxscore) |
