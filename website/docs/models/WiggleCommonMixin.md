---
id: wigglecommonmixin
title: WiggleCommonMixin
description: "Extends ScoreFieldConfigMixin with the narrowed rpcDataMap, the autoscale domain and the wiggle-specific config: the origin, rendering type, summary mode, resolution and the line/gap settings.…"
sidebar_label: Mixin -> WiggleCommonMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleCommonMixin.ts).

Extends `ScoreFieldConfigMixin` with the narrowed rpcDataMap, the autoscale
domain and the wiggle-specific config: the origin, rendering type,
summary mode, resolution and the line/gap settings. Extended on this chain
with `.props()`/`.views()` rather than a mixin composed in, so no
`types.compose` layer is added (ADR-041).

Used by LinearWiggleDisplay and gccontent's two GC displays.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<span data-pagefind-ignore>From [ScoreScaleMixin](../scorescalemixin): <span id="volatile-unclippedquantile">[`unclippedQuantile`](../scorescalemixin#volatile-unclippedquantile)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-resolution">**resolution**</span><br><code>number</code> | Points per pixel the fetch asks for, clamped to what the Resolution menu offers: the slot is reachable from a track config, which runs no setter, and `0` there divides by zero inside the adapter. |
| <span id="getter-rpcdatamap">**rpcDataMap**</span><br><code>ReadonlyMap&lt;number, WiggleDataResult&gt;</code> | The fetched scores, keyed by displayedRegionIndex — the foundation's per-region store, narrowed. |
| <span id="getter-origin">**origin**</span><br><code>number</code> | The value bars grow from, which a color scale also reads where its own domain says nothing. |
| <span id="getter-linewidth">**lineWidth**</span><br><code>number</code> | A line's width, the `size` slot or 1 px while unset. |
| <span id="getter-size">**size**</span><br><code>number</code> | A point's diameter, the `size` slot or 2 px while unset. |
| <span id="getter-maxgapmultiple">**maxGapMultiple**</span><br><code>number</code> | Interpolated-line gap threshold, as a multiple of the track's own mean point spacing (see gapBreakLimit). 0 keeps one connected line. |
| <span id="getter-aggregate">**aggregate**</span><br><code>string</code> |  |
| <span id="getter-renderingtype">**renderingType**</span><br><code>"density" &#124; "line" &#124; "linecenter" &#124; "scatter" &#124; "xyplot"</code> |  |
| <span id="getter-hasresolution">**hasResolution**</span><br><code>boolean</code> | Asked of the display's OWN adapter, which for the GC display is the synthesized GCContentAdapter rather than the track's raw sequence adapter — the two diverged when the adapter config moved onto the shared model. It answers the same today, since only BigWigAdapter and MultiWiggleAdapter declare the capability, and the display's adapter is the honest subject: the resolution slot it gates is passed to whatever this display fetches from. |
| <span id="getter-effectiveaggregate">**effectiveAggregate**</span><br><code>string</code> | The summary mode actually drawn. Density has no whiskers presentation — `sourceLayers` falls back to the average scores — so the autoscale domain reads this rather than the raw slot; otherwise the color ramp spans the whisker extremes while the plot paints averages, and the score legend reports a range nothing on screen reaches. Single-wiggle defaults to whiskers, so plain "plot type → Density" hit this. |
| <span id="getter-autoscalesourcenames">**autoscaleSourceNames**</span><br><code>Set&lt;string&gt; &#124; undefined</code> | Source names to include when computing the autoscale domain; `undefined` means every fetched source. The wiggle display always fetches all sources and filters client-side, so it overrides this to the visible subset — otherwise a subtree filter that hides sources would leave the Y-axis scaled to the hidden ones. |
| <span id="getter-scorerulevalues">**scoreRuleValues**</span><br><code>number[]</code> | Scores the axis must reach whatever the data does, so a rule drawn at one stays on it. `[]` here and overridden by the display that draws `scales.y.rules`. |
| <span id="getter-autoscalerange">**autoscaleRange**</span><br><code>[number, number] &#124; undefined</code> | What the sources visible in the settled blocks span, under the autoscale mode. `undefined` until the view and the data are ready, which is not the `[0, 1]` a caller falls back to — see `visibleStatsRange`. |
| <span id="getter-domain">**domain**</span><br><code>[number, number] &#124; undefined</code> |  |
| <span id="getter-defaultscoredomain">**defaultScoreDomain**</span><br><code>[number &#124; undefined, number &#124; undefined]</code> | The bounds the adapter declares its values lie in, where it declares any (`getValueDomain`): a GC content track's [0, 1], so its axis reads alike at every locus. Config bounds still win. |

<span data-pagefind-ignore>From [ScoreFieldConfigMixin](../scorefieldconfigmixin): <span id="getter-scorefield">[`scoreField`](../scorefieldconfigmixin#getter-scorefield)</span></span>

<span data-pagefind-ignore>From [WiggleScoreConfigMixin](../wigglescoreconfigmixin): <span id="getter-isdensitymode">[`isDensityMode`](../wigglescoreconfigmixin#getter-isdensitymode)</span>, <span id="getter-axisreacheszero">[`axisReachesZero`](../wigglescoreconfigmixin#getter-axisreacheszero)</span></span>

<span data-pagefind-ignore>From [ScoreScaleMixin](../scorescalemixin): <span id="getter-scaletype">[`scaleType`](../scorescalemixin#getter-scaletype)</span>, <span id="getter-scalezero">[`scaleZero`](../scorescalemixin#getter-scalezero)</span>, <span id="getter-domainquantile">[`domainQuantile`](../scorescalemixin#getter-domainquantile)</span>, <span id="getter-clipquantile">[`clipQuantile`](../scorescalemixin#getter-clipquantile)</span>, <span id="getter-symlogconstant">[`symlogConstant`](../scorescalemixin#getter-symlogconstant)</span>, <span id="getter-manualminscore">[`manualMinScore`](../scorescalemixin#getter-manualminscore)</span>, <span id="getter-manualmaxscore">[`manualMaxScore`](../scorescalemixin#getter-manualmaxscore)</span>, <span id="getter-valuescalenotices">[`valueScaleNotices`](../scorescalemixin#getter-valuescalenotices)</span>, <span id="getter-autoscalegroup">[`autoscaleGroup`](../scorescalemixin#getter-autoscalegroup)</span>, <span id="getter-scaletitle">[`scaleTitle`](../scorescalemixin#getter-scaletitle)</span>, <span id="getter-grid">[`grid`](../scorescalemixin#getter-grid)</span>, <span id="getter-minimalticks">[`minimalTicks`](../scorescalemixin#getter-minimalticks)</span>, <span id="getter-scorerulesdrawn">[`scoreRulesDrawn`](../scorescalemixin#getter-scorerulesdrawn)</span>, <span id="getter-scorerules">[`scoreRules`](../scorescalemixin#getter-scorerules)</span></span>

<span data-pagefind-ignore>From [ScoreAxisMixin](../scoreaxismixin): <span id="getter-valuescales">[`valueScales`](../scoreaxismixin#getter-valuescales)</span>, <span id="getter-autoscaleddomain">[`autoscaledDomain`](../scoreaxismixin#getter-autoscaleddomain)</span>, <span id="getter-minscorebound">[`minScoreBound`](../scoreaxismixin#getter-minscorebound)</span>, <span id="getter-maxscorebound">[`maxScoreBound`](../scoreaxismixin#getter-maxscorebound)</span>, <span id="getter-hasmanualscorebounds">[`hasManualScoreBounds`](../scoreaxismixin#getter-hasmanualscorebounds)</span>, <span id="getter-axes">[`axes`](../scoreaxismixin#getter-axes)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setrpcdata">**setRpcData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(displayedRegionIndex: number, data: WiggleDataResult, region:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(displayedRegionIndex: number, data: WiggleDataResult, region: Region) =&gt; void</code></pre></dialog></span> | Stage a region as fetched, with this mixin's payload shape — so a test stands up a loaded display in one call. Production goes through `ctx.commitRegion`. |
| <span id="action-selectfeature">**selectFeature**</span><br><code>(feat: WiggleHoveredFeature) =&gt; void</code> |  |
| <span id="action-setresolution">**setResolution**</span><br><code>(res: number) =&gt; void</code> |  |
| <span id="action-setorigin">**setOrigin**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setrenderingtype">**setRenderingType**</span><br><code>(type: string) =&gt; void</code> |  |
| <span id="action-setaggregate">**setAggregate**</span><br><code>(val: string) =&gt; void</code> |  |
| <span id="action-setlinewidth">**setLineWidth**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setsize">**setSize**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |

<span data-pagefind-ignore>From [ScoreScaleMixin](../scorescalemixin): <span id="action-setscaletype">[`setScaleType`](../scorescalemixin#action-setscaletype)</span>, <span id="action-setscalezero">[`setScaleZero`](../scorescalemixin#action-setscalezero)</span>, <span id="action-setdomainquantile">[`setDomainQuantile`](../scorescalemixin#action-setdomainquantile)</span>, <span id="action-setminscore">[`setMinScore`](../scorescalemixin#action-setminscore)</span>, <span id="action-setmaxscore">[`setMaxScore`](../scorescalemixin#action-setmaxscore)</span>, <span id="action-setautoscalegroup">[`setAutoscaleGroup`](../scorescalemixin#action-setautoscalegroup)</span>, <span id="action-setgrid">[`setGrid`](../scorescalemixin#action-setgrid)</span>, <span id="action-setscorerules">[`setScoreRules`](../scorescalemixin#action-setscorerules)</span></span>
