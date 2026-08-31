---
id: wigglescoreconfigmixin
title: WiggleScoreConfigMixin
sidebar_label: Mixin -> WiggleScoreConfigMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`wiggle` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleScoreConfigMixin.ts).

The score-PLOT config every wiggle-family display shares: the score axis
(`ScoreScaleMixin`), the cross-hatch toggle and the scatter point size. Config
only. The strict-`bpPerPx` fetch rule (adr-008) belongs to `WiggleCommonMixin`,
as its `regionFetchKey`, because it describes what a fetch returns rather than
how a plot is drawn — `LinearManhattanDisplay` composes this mixin for the score
axis and fetches untransformed SNPs.

Deliberately NOT the wiggle-specific palette, rendering-type, summary-mode and
resolution config either — those moved to `WiggleCommonMixin`, which composes
this, when it became clear that `LinearManhattanDisplay` (the other composer)
reads none of them and was inheriting a config schema that advertised twelve
slots doing nothing on a Manhattan plot. Relocation rather than a new mixin
layer: `types.compose` depth is a real ceiling in these chains (ADR-041).

A display that owns its own rpcDataMap type composes this; a wiggle-shaped one
composes `WiggleCommonMixin`.

The score _axis_ itself (scaleType / autoscale / min-max and their setters) is
`ScoreScaleMixin`, composed in below and shared with the alignments coverage
band, which wants that axis and none of the color/resolution config here.

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-scatterpointsize">**scatterPointSize**</span><br><code>number</code> |  | WiggleScoreConfigMixin |
| <span id="getter-displaycrosshatches">**displayCrossHatches**</span><br><code>boolean</code> | The configured cross-hatch setting. A config slot rather than a display prop — like `scatterPointSize` beside it — because a prop cannot be set from a config at all: MST drops a snapshot key the schema never declares, so `demos/cgiab` had asked for hatches on its CNV track and never got them. Read `showCrossHatches` below for what actually draws; this is the raw setting the menu toggles. | WiggleScoreConfigMixin |
| <span id="getter-isdensitymode">**isDensityMode**</span><br><code>boolean</code> | Whether score maps to color instead of height. Each display overrides this from its own rendering-type table (`density` / `multirowdensity`); the base is false so this mixin's resolved getters below can key on it, the same override idiom `autoscaleSourceNames` uses in WiggleCommonMixin. | WiggleScoreConfigMixin |
| <span id="getter-showcrosshatches">**showCrossHatches**</span><br><code>boolean</code> | Whether the score-axis cross hatches draw. Density spends color, not height, on the score, so there is no axis for them to rule — and the track menu drops the toggle there, which would strand hatches enabled in another plot type with no way to turn them off. Every consumer (on-screen overlay, multi-row overlay lines, SVG export) reads this, never the raw `displayCrossHatches` setting. | WiggleScoreConfigMixin |
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
| <span id="action-togglecrosshatches">**toggleCrossHatches**</span><br><code>() =&gt; void</code> |  | WiggleScoreConfigMixin |
| <span id="action-setscatterpointsize">**setScatterPointSize**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | WiggleScoreConfigMixin |
| <span id="action-setscaletype">**setScaleType**</span><br><code>(scaleType: string) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setscaletype) |
| <span id="action-setautoscale">**setAutoscale**</span><br><code>(val?: string &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setautoscale) |
| <span id="action-setminscore">**setMinScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setminscore) |
| <span id="action-setmaxscore">**setMaxScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  | [ScoreScaleMixin](../scorescalemixin#action-setmaxscore) |
