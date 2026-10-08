---
id: scorescalemixin
title: ScoreScaleMixin
description: "Value scale, written in scales.y. valueScaleSchema / scalesSchema. Brings ScoreAxisMixin plus scaleType / scaleZero / domainQuantile / clipQuantile / symlogConstant / manual and…"
sidebar_label: Mixin -> ScoreScaleMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/ScoreScaleMixin.ts).

Value scale, written in `scales.y`. `valueScaleSchema` / `scalesSchema`. Brings `ScoreAxisMixin` plus `scaleType` / `scaleZero` / `domainQuantile` / `clipQuantile` / `symlogConstant` / `manual*` and their setters, i.e. the whole `ScoreScaleModel` interface the Y axis row and its drawer widget consume

The value scale of every quantitative display: wiggle, the alignments
coverage band and the mark display, Manhattan among them, each declare
`scales.y` through valueScaleSchema and compose this. It backs
ScoreAxisMixin's three overridable members off that object and adds
the setters that write it, so composing this is how a display satisfies
ScoreScaleModel in `scoreMenuItems.ts` — the interface the Y axis
row and its drawer widget consume.

Deliberately just the scale and the guides it owns. Colors, `resolution`
and the autoscale *computation* stay in `WiggleScoreConfigMixin` /
`WiggleCommonMixin` — the alignments coverage band shares this scale but
none of the rest.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-unclippedquantile">**unclippedQuantile**</span><br><code>number &#124; undefined</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-scaletype">**scaleType**</span><br><code>string</code> |  |
| <span id="getter-scalezero">**scaleZero**</span><br><code>boolean</code> | `scales.y.zero`: whether an autoscaled linear or symlog axis reaches 0. |
| <span id="getter-domainquantile">**domainQuantile**</span><br><code>number</code> | `scales.y.domainQuantile`: what an unpinned end follows, 1 the extremes and below it that quantile of each sign. |
| <span id="getter-clipquantile">**clipQuantile**</span><br><code>number</code> | The quantile "Clip extreme outliers" fences at: the one an untick this session wrote over, else the scale's own default where that is below 1, else 0.99. |
| <span id="getter-symlogconstant">**symlogConstant**</span><br><code>number</code> | Raw slot; `0` means "derive from the domain". Resolve it with `resolveSymlogConstant` once the domain is known. |
| <span id="getter-manualminscore">**manualMinScore**</span><br><code>number &#124; undefined</code> | The lower bound the config pins, `undefined` where it pins none. |
| <span id="getter-manualmaxscore">**manualMaxScore**</span><br><code>number &#124; undefined</code> | The upper bound the config pins, `undefined` where it pins none. |
| <span id="getter-valuescalenotices">**valueScaleNotices**</span><br><code>string[]</code> | What `scales.y`'s ends say together that the axis cannot draw as written, as corner-notice lines, by the rule a colour ramp's ends answer to. The mark display reports them through its rule list. |
| <span id="getter-autoscalegroup">**autoscaleGroup**</span><br><code>string &#124; undefined</code> | `scales.y.autoscaleGroup`, `undefined` while it names none. |
| <span id="getter-scaletitle">**scaleTitle**</span><br><code>string</code> | `scales.y.title`, `''` while unset |
| <span id="getter-grid">**grid**</span><br><code>boolean</code> | `scales.y.grid` |
| <span id="getter-minimalticks">**minimalTicks**</span><br><code>boolean</code> | `scales.y.minimalTicks` |
| <span id="getter-scorerulesdrawn">**scoreRulesDrawn**</span><br><code>boolean</code> | Whether this display draws `scales.y.rules`, which is whether the Y axis panel offers Include 0 and the reference lines: a scale it places y through rules a band for them to cross, which a density plot's colour-mapped rows and a colour ramp do not. |
| <span id="getter-scorerules">**scoreRules**</span><br><code>ValueScaleRule[]</code> | `scales.y.rules`, read off the live nodes: a snapshot strips a slot at its default, and a rule at 0 is one. |

<span data-pagefind-ignore>From [ScoreAxisMixin](../scoreaxismixin): <span id="getter-defaultscoredomain">[`defaultScoreDomain`](../scoreaxismixin#getter-defaultscoredomain)</span>, <span id="getter-valuescales">[`valueScales`](../scoreaxismixin#getter-valuescales)</span>, <span id="getter-autoscalerange">[`autoscaleRange`](../scoreaxismixin#getter-autoscalerange)</span>, <span id="getter-axisreacheszero">[`axisReachesZero`](../scoreaxismixin#getter-axisreacheszero)</span>, <span id="getter-autoscaleddomain">[`autoscaledDomain`](../scoreaxismixin#getter-autoscaleddomain)</span>, <span id="getter-minscorebound">[`minScoreBound`](../scoreaxismixin#getter-minscorebound)</span>, <span id="getter-maxscorebound">[`maxScoreBound`](../scoreaxismixin#getter-maxscorebound)</span>, <span id="getter-hasmanualscorebounds">[`hasManualScoreBounds`](../scoreaxismixin#getter-hasmanualscorebounds)</span>, <span id="getter-axes">[`axes`](../scoreaxismixin#getter-axes)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setscaletype">**setScaleType**</span><br><code>(scaleType: string) =&gt; void</code> |  |
| <span id="action-setscalezero">**setScaleZero**</span><br><code>(zero: boolean) =&gt; void</code> |  |
| <span id="action-setdomainquantile">**setDomainQuantile**</span><br><code>(quantile: number) =&gt; void</code> |  |
| <span id="action-setminscore">**setMinScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setmaxscore">**setMaxScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setautoscalegroup">**setAutoscaleGroup**</span><br><code>(group?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setgrid">**setGrid**</span><br><code>(grid: boolean) =&gt; void</code> |  |
| <span id="action-setscorerules">**setScoreRules**</span><br><code>(rules: (number &#124; ValueScaleRule)[]) =&gt; void</code> | Replaces `scales.y.rules` whole, each entry in a form the config takes: a number, or `{ value, color, label }`. |
