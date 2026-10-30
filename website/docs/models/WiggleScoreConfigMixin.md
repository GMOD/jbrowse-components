---
id: wigglescoreconfigmixin
title: WiggleScoreConfigMixin
description: "The score-plot config every display with a score axis shares: the axis and its guides (ScoreScaleMixin) at the display's paths."
sidebar_label: Mixin -> WiggleScoreConfigMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/WiggleScoreConfigMixin.ts).

The score-plot config every display with a score axis shares: the axis
and its guides (`ScoreScaleMixin`) at the display's `paths`. A display
plotting one configured field composes `YFieldConfigMixin`, which reads
`encoding.y.field`.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited volatile from one model</summary>

From [ScoreScaleMixin](../scorescalemixin): <span id="volatile-unclippedfencequantile">[`unclippedFenceQuantile`](../scorescalemixin#volatile-unclippedfencequantile)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-isdensitymode">**isDensityMode**</span><br><code>boolean</code> | Whether score maps to color instead of height; a display overrides it. |
| <span id="getter-axisreacheszero">**axisReachesZero**</span><br><code>boolean</code> | A density row maps score to color and has no axis to start at 0, so its domain spans the values whatever the y scale's `zero` says. |

<details class="inherited-members" data-pagefind-ignore>
<summary>22 inherited getters from 2 models</summary>

From [ScoreScaleMixin](../scorescalemixin): <span id="getter-scaletype">[`scaleType`](../scorescalemixin#getter-scaletype)</span>, <span id="getter-scalezero">[`scaleZero`](../scorescalemixin#getter-scalezero)</span>, <span id="getter-fencequantile">[`fenceQuantile`](../scorescalemixin#getter-fencequantile)</span>, <span id="getter-clipfencequantile">[`clipFenceQuantile`](../scorescalemixin#getter-clipfencequantile)</span>, <span id="getter-symlogconstant">[`symlogConstant`](../scorescalemixin#getter-symlogconstant)</span>, <span id="getter-domainmin">[`domainMin`](../scorescalemixin#getter-domainmin)</span>, <span id="getter-domainmax">[`domainMax`](../scorescalemixin#getter-domainmax)</span>, <span id="getter-autoscalegroup">[`autoscaleGroup`](../scorescalemixin#getter-autoscalegroup)</span>, <span id="getter-scaletitle">[`scaleTitle`](../scorescalemixin#getter-scaletitle)</span>, <span id="getter-grid">[`grid`](../scorescalemixin#getter-grid)</span>, <span id="getter-showaxis">[`showAxis`](../scorescalemixin#getter-showaxis)</span>, <span id="getter-scorerulesdrawn">[`scoreRulesDrawn`](../scorescalemixin#getter-scorerulesdrawn)</span>, <span id="getter-scorerules">[`scoreRules`](../scorescalemixin#getter-scorerules)</span>, <span id="getter-axisguide">[`axisGuide`](../scorescalemixin#getter-axisguide)</span>

From [ScoreAxisMixin](../scoreaxismixin): <span id="getter-defaultscoredomain">[`defaultScoreDomain`](../scoreaxismixin#getter-defaultscoredomain)</span>, <span id="getter-valuescales">[`valueScales`](../scoreaxismixin#getter-valuescales)</span>, <span id="getter-autoscalerange">[`autoscaleRange`](../scoreaxismixin#getter-autoscalerange)</span>, <span id="getter-autoscaleddomain">[`autoscaledDomain`](../scoreaxismixin#getter-autoscaleddomain)</span>, <span id="getter-resolveddomainmin">[`resolvedDomainMin`](../scoreaxismixin#getter-resolveddomainmin)</span>, <span id="getter-resolveddomainmax">[`resolvedDomainMax`](../scoreaxismixin#getter-resolveddomainmax)</span>, <span id="getter-pinsdomain">[`pinsDomain`](../scoreaxismixin#getter-pinsdomain)</span>, <span id="getter-axes">[`axes`](../scoreaxismixin#getter-axes)</span>

</details>

## Actions

<details class="inherited-members" data-pagefind-ignore>
<summary>11 inherited actions from one model</summary>

From [ScoreScaleMixin](../scorescalemixin): <span id="action-setscaletype">[`setScaleType`](../scorescalemixin#action-setscaletype)</span>, <span id="action-setscalezero">[`setScaleZero`](../scorescalemixin#action-setscalezero)</span>, <span id="action-setfencequantile">[`setFenceQuantile`](../scorescalemixin#action-setfencequantile)</span>, <span id="action-setdomainmin">[`setDomainMin`](../scorescalemixin#action-setdomainmin)</span>, <span id="action-setdomainmax">[`setDomainMax`](../scorescalemixin#action-setdomainmax)</span>, <span id="action-setminscore">[`setMinScore`](../scorescalemixin#action-setminscore)</span>, <span id="action-setmaxscore">[`setMaxScore`](../scorescalemixin#action-setmaxscore)</span>, <span id="action-setautoscalegroup">[`setAutoscaleGroup`](../scorescalemixin#action-setautoscalegroup)</span>, <span id="action-setgrid">[`setGrid`](../scorescalemixin#action-setgrid)</span>, <span id="action-setscorerules">[`setScoreRules`](../scorescalemixin#action-setscorerules)</span>, <span id="action-resetyscale">[`resetYScale`](../scorescalemixin#action-resetyscale)</span>

</details>
