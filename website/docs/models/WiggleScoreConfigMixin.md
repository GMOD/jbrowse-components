---
id: wigglescoreconfigmixin
title: WiggleScoreConfigMixin
sidebar_label: Mixin -> WiggleScoreConfigMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`wiggle` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleScoreConfigMixin.ts).

Score/scale/color config and isCacheValid for wiggle-family displays. Does NOT
include rpcDataMap or autoscale domain computation — those live in
WiggleCommonMixin, which composes this. Displays that own their own rpcDataMap
type (e.g. LinearManhattanDisplay) should compose this instead.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-resolution">**resolution**</span><br><code>resolution: types.stripDefault(types.number, 1)</code> |  |
| <span id="property-displaycrosshatches">**displayCrossHatches**</span><br><code>displayCrossHatches: types.stripDefault(types.boolean, false)</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-loadedbpperpx">**loadedBpPerPx**</span><br><code>loadedBpPerPx: undefined as number &#124; undefined</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-poscolor">**posColor**</span><br><code>string</code> |  |
| <span id="getter-negcolor">**negColor**</span><br><code>string</code> |  |
| <span id="getter-bicolorpivot">**bicolorPivot**</span><br><code>number</code> |  |
| <span id="getter-scaletype">**scaleType**</span><br><code>string</code> |  |
| <span id="getter-autoscaletype">**autoscaleType**</span><br><code>string</code> |  |
| <span id="getter-numstddev">**numStdDev**</span><br><code>number</code> |  |
| <span id="getter-numquantile">**numQuantile**</span><br><code>number</code> |  |
| <span id="getter-scatterpointsize">**scatterPointSize**</span><br><code>number</code> |  |
| <span id="getter-linewidth">**lineWidth**</span><br><code>number</code> |  |
| <span id="getter-summaryscoremode">**summaryScoreMode**</span><br><code>string</code> |  |
| <span id="getter-renderingtype">**renderingType**</span><br><code>string</code> |  |
| <span id="getter-isdensitymode">**isDensityMode**</span><br><code>boolean</code> | Whether score maps to color instead of height. Each display overrides this from its own rendering-type table (`density` / `multirowdensity`); the base is false so this mixin's resolved getters below can key on it, the same override idiom `autoscaleSourceNames` uses in WiggleCommonMixin. |
| <span id="getter-minscore">**minScore**</span><br><code>number</code> |  |
| <span id="getter-maxscore">**maxScore**</span><br><code>number</code> |  |
| <span id="getter-minscorebound">**minScoreBound**</span><br><code>number &#124; undefined</code> |  |
| <span id="getter-maxscorebound">**maxScoreBound**</span><br><code>number &#124; undefined</code> |  |
| <span id="getter-hasresolution">**hasResolution**</span><br><code>boolean</code> |  |
| <span id="getter-showcrosshatches">**showCrossHatches**</span><br><code>boolean</code> | Whether the score-axis cross hatches draw. Density spends color, not height, on the score, so there is no axis for them to rule — and the track menu drops the toggle there, which would strand hatches enabled in another plot type with no way to turn them off. Every consumer (on-screen overlay, multi-row overlay lines, SVG export) reads this, never the raw `displayCrossHatches` prop. |
| <span id="getter-effectivesummaryscoremode">**effectiveSummaryScoreMode**</span><br><code>string</code> | The summary mode actually drawn. Density has no whiskers presentation — `sourceLayers` falls back to the average scores — so the autoscale domain reads this rather than the raw slot; otherwise the color ramp spans the whisker extremes while the plot paints averages, and the score legend reports a range nothing on screen reaches. Single-wiggle defaults to whiskers, so plain "plot type → Density" hit this. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-iscachevalid">**isCacheValid**</span><br><code>(_displayedRegionIndex: number) =&gt; boolean</code> | Strict zoom equality: see adr-008. A view, not an action, so the `view.bpPerPx` read below actually registers as a dependency of whoever calls it (see MultiRegionDisplayMixin's hook block). |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-togglecrosshatches">**toggleCrossHatches**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setresolution">**setResolution**</span><br><code>(res: number) =&gt; void</code> |  |
| <span id="action-setloadedbpperpx">**setLoadedBpPerPx**</span><br><code>(bpPerPx: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setscaletype">**setScaleType**</span><br><code>(scaleType: string) =&gt; void</code> |  |
| <span id="action-setbicolorpivot">**setBicolorPivot**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setposcolor">**setPosColor**</span><br><code>(color?: string &#124; undefined) =&gt; void</code> | Lives here beside the `posColor`/`negColor` getters and `setBicolorPivot` so both the single- and multi-wiggle color editors write the score-sign palette the same way. |
| <span id="action-setnegcolor">**setNegColor**</span><br><code>(color?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setminscore">**setMinScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setmaxscore">**setMaxScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setrenderingtype">**setRenderingType**</span><br><code>(type: string) =&gt; void</code> |  |
| <span id="action-setsummaryscoremode">**setSummaryScoreMode**</span><br><code>(val: string) =&gt; void</code> |  |
| <span id="action-setscatterpointsize">**setScatterPointSize**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setlinewidth">**setLineWidth**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setautoscale">**setAutoscale**</span><br><code>(val?: string &#124; undefined) =&gt; void</code> |  |
