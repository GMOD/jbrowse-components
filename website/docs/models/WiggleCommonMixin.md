---
id: wigglecommonmixin
title: WiggleCommonMixin
sidebar_label: Mixin -> WiggleCommonMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleCommonMixin.ts).

Extends `ScoreFieldConfigMixin` with the narrowed rpcDataMap, the autoscale
domain and the wiggle-specific config: the origin, rendering type,
summary mode, resolution and the line/gap settings. Extended on this chain
with `.props()`/`.views()` rather than a mixin composed in, so no
`types.compose` layer is added (ADR-041).

Used by LinearWiggleDisplay and gccontent's two GC displays.

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-resolution">**resolution**</span><br><code>number</code> | Points per pixel the fetch asks for, clamped to what the Resolution menu offers: the slot is reachable from a track config, which runs no setter, and `0` there divides by zero inside the adapter. | WiggleCommonMixin |
| <span id="getter-rpcdatamap">**rpcDataMap**</span><br><code>ReadonlyMap&lt;number, WiggleDataResult&gt;</code> | The fetched scores, keyed by displayedRegionIndex — the foundation's per-region store, narrowed. | WiggleCommonMixin |
| <span id="getter-origin">**origin**</span><br><code>number</code> | The value bars grow from, which a colour scale also reads where its own domain says nothing. | WiggleCommonMixin |
| <span id="getter-linewidth">**lineWidth**</span><br><code>number</code> |  | WiggleCommonMixin |
| <span id="getter-maxgapmultiple">**maxGapMultiple**</span><br><code>number</code> | Interpolated-line gap threshold, as a multiple of the track's own mean point spacing (see gapBreakLimit). 0 keeps one connected line. | WiggleCommonMixin |
| <span id="getter-summaryscoremode">**summaryScoreMode**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-renderingtype">**renderingType**</span><br><code>string</code> |  | WiggleCommonMixin |
| <span id="getter-hasresolution">**hasResolution**</span><br><code>boolean</code> | Asked of the display's OWN adapter, which for the GC display is the synthesized GCContentAdapter rather than the track's raw sequence adapter — the two diverged when the adapter config moved onto the shared model. It answers the same today, since only BigWigAdapter and MultiWiggleAdapter declare the capability, and the display's adapter is the honest subject: the resolution slot it gates is passed to whatever this display fetches from. | WiggleCommonMixin |
| <span id="getter-effectivesummaryscoremode">**effectiveSummaryScoreMode**</span><br><code>string</code> | The summary mode actually drawn. Density has no whiskers presentation — `sourceLayers` falls back to the average scores — so the autoscale domain reads this rather than the raw slot; otherwise the color ramp spans the whisker extremes while the plot paints averages, and the score legend reports a range nothing on screen reaches. Single-wiggle defaults to whiskers, so plain "plot type → Density" hit this. | WiggleCommonMixin |
| <span id="getter-autoscalesourcenames">**autoscaleSourceNames**</span><br><code>Set&lt;string&gt; &#124; undefined</code> | Source names to include when computing the autoscale domain; `undefined` means every fetched source. The wiggle display always fetches all sources and filters client-side, so it overrides this to the visible subset — otherwise a subtree filter that hides sources would leave the Y-axis scaled to the hidden ones. | WiggleCommonMixin |
| <span id="getter-scorerulevalues">**scoreRuleValues**</span><br><code>number[]</code> | Scores the axis must reach whatever the data does, so a rule drawn at one stays on it. `[]` here and overridden by the display that draws `scales.y.rules`. | WiggleCommonMixin |
| <span id="getter-autoscalerange">**autoscaleRange**</span><br><code>[number, number] &#124; undefined</code> | What the sources visible in the settled blocks span, under the autoscale mode. `undefined` until the view and the data are ready, which is not the `[0, 1]` a caller falls back to — see `visibleStatsRange`. | WiggleCommonMixin |
| <span id="getter-domain">**domain**</span><br><code>[number, number] &#124; undefined</code> |  | WiggleCommonMixin |
| <span id="getter-scorefield">**scoreField**</span><br><code>string</code> | <span data-pagefind-ignore>The feature field the worker plots on the score axis, `score` by default. A fetch input: every composing display carries it in its `rpcProps()`, since the field is read where the features are.</span> | [ScoreFieldConfigMixin](../scorefieldconfigmixin#getter-scorefield) |
| <span id="getter-size">**size**</span><br><code>number</code> |  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-size) |
| <span id="getter-isdensitymode">**isDensityMode**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether score maps to color instead of height; a display overrides it.</span> | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-isdensitymode) |
| <span id="getter-showcrosshatches">**showCrossHatches**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the score-axis cross hatches draw: `scales.y.grid`, never in density mode, which has no height axis to rule and no toggle in its menu.</span> | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#getter-showcrosshatches) |
| <span id="getter-scaletype">**scaleType**</span><br><code>string</code> |  | [ScoreScaleMixin](../scorescalemixin#getter-scaletype) |
| <span id="getter-scaletypechoices">**scaleTypeChoices**</span><br><code>string[]</code> | <span data-pagefind-ignore>The scale types this display's own enum admits, which is what the scale-type radio offers; a display with one draws no radio.</span> | [ScoreScaleMixin](../scorescalemixin#getter-scaletypechoices) |
| <span id="getter-autoscaletype">**autoscaleType**</span><br><code>string &#124; undefined</code> | <span data-pagefind-ignore>`undefined` on a display whose domain consults no autoscale mode.</span> | [ScoreScaleMixin](../scorescalemixin#getter-autoscaletype) |
| <span id="getter-numstddev">**numStdDev**</span><br><code>number</code> |  | [ScoreScaleMixin](../scorescalemixin#getter-numstddev) |
| <span id="getter-numquantile">**numQuantile**</span><br><code>number</code> |  | [ScoreScaleMixin](../scorescalemixin#getter-numquantile) |
| <span id="getter-symlogconstant">**symlogConstant**</span><br><code>number</code> | <span data-pagefind-ignore>Raw slot; `0` means "derive from the domain". Resolve it with `resolveSymlogConstant` once the domain is known.</span> | [ScoreScaleMixin](../scorescalemixin#getter-symlogconstant) |
| <span id="getter-manualminscore">**manualMinScore**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>The lower bound the config pins, `undefined` where it pins none.</span> | [ScoreScaleMixin](../scorescalemixin#getter-manualminscore) |
| <span id="getter-manualmaxscore">**manualMaxScore**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>The upper bound the config pins, `undefined` where it pins none.</span> | [ScoreScaleMixin](../scorescalemixin#getter-manualmaxscore) |
| <span id="getter-autoscalegroup">**autoscaleGroup**</span><br><code>string &#124; undefined</code> | <span data-pagefind-ignore>`scales.y.autoscaleGroup`, `undefined` while it names none.</span> | [ScoreScaleMixin](../scorescalemixin#getter-autoscalegroup) |
| <span id="getter-scaletitle">**scaleTitle**</span><br><code>string &#124; undefined</code> | <span data-pagefind-ignore>`scales.y.title` as written, `undefined` while unset or on a display whose scale declares no title.</span> | [ScoreScaleMixin](../scorescalemixin#getter-scaletitle) |
| <span id="getter-grid">**grid**</span><br><code>boolean</code> | <span data-pagefind-ignore>`scales.y.grid`, false on a display whose scale declares none.</span> | [ScoreScaleMixin](../scorescalemixin#getter-grid) |
| <span id="getter-minimalticks">**minimalTicks**</span><br><code>boolean</code> | <span data-pagefind-ignore>`scales.y.minimalTicks`, false on a display whose scale declares none.</span> | [ScoreScaleMixin](../scorescalemixin#getter-minimalticks) |
| <span id="getter-scorerulesdrawn">**scoreRulesDrawn**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether this display draws `scales.y.rules`, which is whether the score menu offers the reference lines: its scale declares them, and a scale it places y through rules a band for them to cross, which a density plot's colour-mapped rows and a colour ramp do not.</span> | [ScoreScaleMixin](../scorescalemixin#getter-scorerulesdrawn) |
| <span id="getter-scorerules">**scoreRules**</span><br><code>ValueScaleRule[]</code> | <span data-pagefind-ignore>`scales.y.rules`, read off the live nodes: a snapshot strips a slot at its default, and a rule at 0 is one. Empty on a display whose scale declares no rules.</span> | [ScoreScaleMixin](../scorescalemixin#getter-scorerules) |
| <span id="getter-defaultscoredomain">**defaultScoreDomain**</span><br><code>[number &#124; undefined, number &#124; undefined]</code> | <span data-pagefind-ignore>Overridable hook: what each end of the domain falls back to where the config leaves its bound unset. `[undefined, undefined]` — the default — means autoscale both ends, which is right for a track whose scores have no absolute meaning (a bigwig's units are its own).<br><br>A display whose scores are bounded *by construction* overrides it, so the axis stops being a function of what happens to be on screen: GC content is a fraction, so 0 and 1 are its real limits and mean the same thing at every locus. Autoscaled, the same GC value drew at different heights depending on where the user had panned, and the track could not be read across loci.<br><br>A hook rather than a config default because the answer can depend on display state — GC's does, on `gcMode` — and rather than each display re-resolving the sentinels, which is the one thing that must not be duplicated: config bounds still win, precisely because they are checked before this is consulted.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-defaultscoredomain) |
| <span id="getter-valuescales">**valueScales**</span><br><code>ValueScale[]</code> | <span data-pagefind-ignore>Overridable hook (default none): the scales this display draws its y through. A display that answers it gets an axis per band of each, with its cross-hatches, placed by `DisplayChrome` and `renderDisplaySvg`, and the ticks derived below.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-valuescales) |
| <span id="getter-autoscaleddomain">**autoscaledDomain**</span><br><code>[number, number] &#124; undefined</code> | <span data-pagefind-ignore>The domain an autoscaled axis draws: `autoscaleRange`, widened to every range its `autoscaleGroup` holds, nice-rounded inside this display's own bounds. Each member unions the others' own ranges and never their domains, so a pinned end stays the display's that pinned it. `undefined` while this display has nothing of its own to scale.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-autoscaleddomain) |
| <span id="getter-minscorebound">**minScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved lower bound; `undefined` means autoscale this end.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-minscorebound) |
| <span id="getter-maxscorebound">**maxScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved upper bound; `undefined` means autoscale this end.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-maxscorebound) |
| <span id="getter-hasmanualscorebounds">**hasManualScoreBounds**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the user has pinned either end, which is a different question from whether either end resolved to a number: `defaultScoreDomain` fills the unset ends in, so a GC content track answers yes to the second with nothing configured. The score menu asks this one — it captions the min/max row with the range in force, and a caption off the resolved pair named a range on every freshly opened GC content track.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-hasmanualscorebounds) |
| <span id="getter-axes">**axes**</span><br><code>YAxis[]</code> | <span data-pagefind-ignore>The axes, one per declared scale whose domain resolved: where each tick lands in the band's own pixel space, through `computeYTicks` unless the scale brought its own ladder, and where each of the scale's `rules` inside the domain lands in that same box, through the scale type the renderer places its values by.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-axes) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setrpcdata">**setRpcData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(displayedRegionIndex: number, data: WiggleDataResult, region:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(displayedRegionIndex: number, data: WiggleDataResult, region: Region) =&gt; void</code></pre></dialog></span> | Stage a region as fetched, with this mixin's payload shape — so a test stands up a loaded display in one call. Production goes through `ctx.commitRegion`. | WiggleCommonMixin |
| <span id="action-selectfeature">**selectFeature**</span><br><code>(feat: WiggleHoveredFeature) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setresolution">**setResolution**</span><br><code>(res: number) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setorigin">**setOrigin**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setrenderingtype">**setRenderingType**</span><br><code>(type: string) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setsummaryscoremode">**setSummaryScoreMode**</span><br><code>(val: string) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setlinewidth">**setLineWidth**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | WiggleCommonMixin |
| <span id="action-setsize">**setSize**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin#action-setsize) |
| <span id="action-setscaletype">**setScaleType**</span><br><code>(scaleType: string) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setscaletype) |
| <span id="action-setautoscale">**setAutoscale**</span><br><code>(val?: string &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setautoscale) |
| <span id="action-setminscore">**setMinScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setminscore) |
| <span id="action-setmaxscore">**setMaxScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setmaxscore) |
| <span id="action-setautoscalegroup">**setAutoscaleGroup**</span><br><code>(group?: string &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setautoscalegroup) |
| <span id="action-setgrid">**setGrid**</span><br><code>(grid: boolean) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setgrid) |
| <span id="action-setscorerules">**setScoreRules**</span><br><code>(rules: (number &#124; ValueScaleRule)[]) =&gt; void</code> | <span data-pagefind-ignore>Replaces `scales.y.rules` whole, each entry in a form the config takes: a number, or `{ value, color, label }`.</span> | [ScoreScaleMixin](../scorescalemixin#action-setscorerules) |
