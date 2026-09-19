---
id: wigglecommonmixin
title: WiggleCommonMixin
sidebar_label: Mixin -> WiggleCommonMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleCommonMixin.ts).

Extends `ScoreFieldConfigMixin` with the narrowed rpcDataMap, the autoscale
domain and the wiggle-specific config: the pos/neg palette, rendering type,
summary mode, resolution and the line/gap settings. Extended on this chain
with `.props()`/`.views()` rather than a mixin composed in, so no
`types.compose` layer is added (ADR-041).

Used by LinearWiggleDisplay and MultiLinearWiggleDisplay.

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-resolution">**resolution**</span><br><code>number</code> | Points per pixel the fetch asks for, clamped to what the Resolution menu offers: the slot is reachable from a track config, which runs no setter, and `0` there divides by zero inside the adapter. | WiggleCommonMixin |
| <span id="getter-rpcdatamap">**rpcDataMap**</span><br><code>ReadonlyMap&lt;number, WiggleDataResult&gt;</code> | The fetched scores, keyed by displayedRegionIndex — the foundation's per-region store, narrowed. | WiggleCommonMixin |
| <span id="getter-symlogconstant">**symlogConstant**</span><br><code>number</code> | Raw `symlogConstant` slot; `0` means "derive from the domain". Resolve it with `resolveSymlogConstant` once the domain is known.<br><br>Here rather than on the score config because only the wiggle schemas declare the slot, and `getConf` returns `undefined` for a composer that does not. | WiggleCommonMixin |
| <span id="getter-poscolor">**posColor**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-negcolor">**negColor**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-bicolorpivot">**bicolorPivot**</span><br><code>number</code> |  | WiggleCommonMixin |
| <span id="getter-densitycolorramp">**densityColorRamp**</span><br><code>string</code> | Density's colour ramp: 'default' for the white→track-colour fade, or a named 256-entry LUT (see densityColorRamp.ts). Rides the render state, so a change is a uniform flag plus one LUT texture upload — never a refetch or a buffer re-encode. | WiggleCommonMixin |
| <span id="getter-numquantile">**numQuantile**</span><br><code>number</code> |  | WiggleCommonMixin |
| <span id="getter-linewidth">**lineWidth**</span><br><code>number</code> |  | WiggleCommonMixin |
| <span id="getter-maxgapmultiple">**maxGapMultiple**</span><br><code>number</code> | Interpolated-line gap threshold, as a multiple of the track's own mean point spacing (see gapBreakLimit). 0 keeps one connected line. | WiggleCommonMixin |
| <span id="getter-summaryscoremode">**summaryScoreMode**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-renderingtype">**renderingType**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-minimalticks">**minimalTicks**</span><br><code>boolean</code> |  | WiggleCommonMixin |
| <span id="getter-hasresolution">**hasResolution**</span><br><code>boolean</code> | Asked of the display's OWN adapter, which for the GC display is the synthesized GCContentAdapter rather than the track's raw sequence adapter — the two diverged when the adapter config moved onto the shared model. It answers the same today, since only BigWigAdapter and MultiWiggleAdapter declare the capability, and the display's adapter is the honest subject: the resolution slot it gates is passed to whatever this display fetches from. | WiggleCommonMixin |
| <span id="getter-effectivesummaryscoremode">**effectiveSummaryScoreMode**</span><br><code>string</code> | The summary mode actually drawn. Density has no whiskers presentation — `sourceLayers` falls back to the average scores — so the autoscale domain reads this rather than the raw slot; otherwise the color ramp spans the whisker extremes while the plot paints averages, and the score legend reports a range nothing on screen reaches. Single-wiggle defaults to whiskers, so plain "plot type → Density" hit this. | WiggleCommonMixin |
| <span id="getter-autoscalesourcenames">**autoscaleSourceNames**</span><br><code>Set&lt;string&gt; &#124; undefined</code> | Source names to include when computing the autoscale domain; `undefined` means every fetched source. Multi-wiggle always fetches all sources and filters client-side, so it overrides this to the visible subset — otherwise a subtree filter that hides sources would leave the Y-axis scaled to the hidden ones. | WiggleCommonMixin |
| <span id="getter-scorerulevalues">**scoreRuleValues**</span><br><code>number[]</code> | Scores the axis must reach whatever the data does, so a rule drawn at one stays on it. `[]` here and overridden by the displays that draw score rules — MultiLinearWiggleDisplay stacks a plot box per row and draws none, so it keeps the base. | WiggleCommonMixin |
| <span id="getter-domain">**domain**</span><br><code>[number, number] &#124; undefined</code> | The autoscaled domain over the sources visible in the settled blocks. `undefined` until the view and the data are ready, which is not the `[0, 1]` a caller falls back to — see `visibleStatsDomain`. | WiggleCommonMixin |
| <span id="getter-scorefield">**scoreField**</span><br><code>string</code> | <span data-pagefind-ignore>The feature field the worker plots on the score axis, `score` by default. A fetch input: every composing display carries it in its `rpcProps()`, since the field is read where the features are.</span> | [ScoreFieldConfigMixin](../scorefieldconfigmixin#getter-scorefield) |
| <span id="getter-scatterpointsize">**scatterPointSize**</span><br><code>number</code> |  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-scatterpointsize) |
| <span id="getter-displaycrosshatches">**displayCrossHatches**</span><br><code>boolean</code> | <span data-pagefind-ignore>The configured cross-hatch setting the menu toggles; `showCrossHatches` is what draws.</span> | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-displaycrosshatches) |
| <span id="getter-isdensitymode">**isDensityMode**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether score maps to color instead of height; a display overrides it.</span> | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-isdensitymode) |
| <span id="getter-showcrosshatches">**showCrossHatches**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the score-axis cross hatches draw: never in density mode, which has no height axis to rule and no toggle in its menu.</span> | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-showcrosshatches) |
| <span id="getter-scaletype">**scaleType**</span><br><code>string</code> |  | [ScoreScaleMixin](../scorescalemixin#getter-scaletype) |
| <span id="getter-autoscaletype">**autoscaleType**</span><br><code>string</code> |  | [ScoreScaleMixin](../scorescalemixin#getter-autoscaletype) |
| <span id="getter-numstddev">**numStdDev**</span><br><code>number</code> |  | [ScoreScaleMixin](../scorescalemixin#getter-numstddev) |
| <span id="getter-minscore">**minScore**</span><br><code>number</code> | <span data-pagefind-ignore>Raw slot value, sentinel intact — see the class comment.</span> | [ScoreScaleMixin](../scorescalemixin#getter-minscore) |
| <span id="getter-maxscore">**maxScore**</span><br><code>number</code> | <span data-pagefind-ignore>Raw slot value, sentinel intact — see the class comment.</span> | [ScoreScaleMixin](../scorescalemixin#getter-maxscore) |
| <span id="getter-manualminscore">**manualMinScore**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>The lower bound the config really sets, `undefined` at the sentinel.</span> | [ScoreScaleMixin](../scorescalemixin#getter-manualminscore) |
| <span id="getter-manualmaxscore">**manualMaxScore**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>The upper bound the config really sets, `undefined` at the sentinel.</span> | [ScoreScaleMixin](../scorescalemixin#getter-manualmaxscore) |
| <span id="getter-defaultscoredomain">**defaultScoreDomain**</span><br><code>[number &#124; undefined, number &#124; undefined]</code> | <span data-pagefind-ignore>Overridable hook: what each end of the domain falls back to where the config leaves its bound unset. `[undefined, undefined]` — the default — means autoscale both ends, which is right for a track whose scores have no absolute meaning (a bigwig's units are its own).<br><br>A display whose scores are bounded *by construction* overrides it, so the axis stops being a function of what happens to be on screen: GC content is a fraction, so 0 and 1 are its real limits and mean the same thing at every locus. Autoscaled, the same GC value drew at different heights depending on where the user had panned, and the track could not be read across loci.<br><br>A hook rather than a config default because the answer can depend on display state — GC's does, on `gcMode` — and rather than each display re-resolving the sentinels, which is the one thing that must not be duplicated: config bounds still win, precisely because they are checked before this is consulted.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-defaultscoredomain) |
| <span id="getter-valuescales">**valueScales**</span><br><code>ValueScale[]</code> | <span data-pagefind-ignore>Overridable hook (default none): the scales this display draws its y through. A display that answers it gets an axis per band of each, with its cross-hatches, placed by `DisplayChrome` and `renderDisplaySvg`, and the ticks derived below.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-valuescales) |
| <span id="getter-minscorebound">**minScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved lower bound; `undefined` means autoscale this end.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-minscorebound) |
| <span id="getter-maxscorebound">**maxScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved upper bound; `undefined` means autoscale this end.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-maxscorebound) |
| <span id="getter-hasmanualscorebounds">**hasManualScoreBounds**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the user has pinned either end, which is a different question from whether either end resolved to a number: `defaultScoreDomain` fills the unset ends in, so a GC content track answers yes to the second with nothing configured. The score menu asks this one — it gates the "Clear manual min/max" row, and a Clear that writes the nothing already there is a row that does nothing and never goes away.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-hasmanualscorebounds) |
| <span id="getter-axes">**axes**</span><br><code>YAxis[]</code> | <span data-pagefind-ignore>The axes, one per declared scale whose domain resolved: where each tick lands in the band's own pixel space, through `computeYTicks` unless the scale brought its own ladder.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-axes) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setrpcdata">**setRpcData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(displayedRegionIndex: number, data: WiggleDataResult, region:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(displayedRegionIndex: number, data: WiggleDataResult, region: Region) =&gt; void</code></pre></dialog></span> | Stage a region as fetched, with this mixin's payload shape — so a test stands up a loaded display in one call. Production goes through `ctx.commitRegion`. | WiggleCommonMixin |
| <span id="action-selectfeature">**selectFeature**</span><br><code>(feat: WiggleHoveredFeature) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setresolution">**setResolution**</span><br><code>(res: number) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setbicolorpivot">**setBicolorPivot**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setposcolor">**setPosColor**</span><br><code>(color?: string &#124; undefined) =&gt; void</code> | Lives here beside the `posColor`/`negColor` getters and `setBicolorPivot` so both the single- and multi-wiggle color editors write the score-sign palette the same way. | WiggleCommonMixin |
| <span id="action-setnegcolor">**setNegColor**</span><br><code>(color?: string &#124; undefined) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setrenderingtype">**setRenderingType**</span><br><code>(type: string) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setsummaryscoremode">**setSummaryScoreMode**</span><br><code>(val: string) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setlinewidth">**setLineWidth**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-togglecrosshatches">**toggleCrossHatches**</span><br><code>() =&gt; void</code> |  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#action-togglecrosshatches) |
| <span id="action-setscatterpointsize">**setScatterPointSize**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#action-setscatterpointsize) |
| <span id="action-setscaletype">**setScaleType**</span><br><code>(scaleType: string) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setscaletype) |
| <span id="action-setautoscale">**setAutoscale**</span><br><code>(val?: string &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setautoscale) |
| <span id="action-setminscore">**setMinScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setminscore) |
| <span id="action-setmaxscore">**setMaxScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setmaxscore) |
