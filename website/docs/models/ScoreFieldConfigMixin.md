---
id: scorefieldconfigmixin
title: ScoreFieldConfigMixin
description: "WiggleScoreConfigMixin plus the y slot, for a display that plots one configured feature field and so declares yFieldConfigSchemaFields: the wiggle display. LinearMarkDisplay names a field per…"
sidebar_label: Mixin -> ScoreFieldConfigMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/ScoreFieldConfigMixin.ts).

`WiggleScoreConfigMixin` plus the `y` slot, for a display that plots one
configured feature field and so declares `yFieldConfigSchemaFields`:
the wiggle display. `LinearMarkDisplay` names a field per mark and composes
the base instead.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<span data-pagefind-ignore>From [ScoreScaleMixin](../scorescalemixin): <span id="volatile-unclippedquantile">[`unclippedQuantile`](../scorescalemixin#volatile-unclippedquantile)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-scorefield">**scoreField**</span><br><code>string</code> | The feature field the worker plots on the value axis, the `y` slot, `score` by default. A fetch input: every composing display carries it in its `rpcProps()`, since the field is read where the features are. |

<span data-pagefind-ignore>From [WiggleScoreConfigMixin](../wigglescoreconfigmixin): <span id="getter-isdensitymode">[`isDensityMode`](../wigglescoreconfigmixin#getter-isdensitymode)</span>, <span id="getter-axisreacheszero">[`axisReachesZero`](../wigglescoreconfigmixin#getter-axisreacheszero)</span></span>

<span data-pagefind-ignore>From [ScoreScaleMixin](../scorescalemixin): <span id="getter-scaletype">[`scaleType`](../scorescalemixin#getter-scaletype)</span>, <span id="getter-scalezero">[`scaleZero`](../scorescalemixin#getter-scalezero)</span>, <span id="getter-domainquantile">[`domainQuantile`](../scorescalemixin#getter-domainquantile)</span>, <span id="getter-clipquantile">[`clipQuantile`](../scorescalemixin#getter-clipquantile)</span>, <span id="getter-symlogconstant">[`symlogConstant`](../scorescalemixin#getter-symlogconstant)</span>, <span id="getter-manualminscore">[`manualMinScore`](../scorescalemixin#getter-manualminscore)</span>, <span id="getter-manualmaxscore">[`manualMaxScore`](../scorescalemixin#getter-manualmaxscore)</span>, <span id="getter-valuescalenotices">[`valueScaleNotices`](../scorescalemixin#getter-valuescalenotices)</span>, <span id="getter-autoscalegroup">[`autoscaleGroup`](../scorescalemixin#getter-autoscalegroup)</span>, <span id="getter-scaletitle">[`scaleTitle`](../scorescalemixin#getter-scaletitle)</span>, <span id="getter-grid">[`grid`](../scorescalemixin#getter-grid)</span>, <span id="getter-minimalticks">[`minimalTicks`](../scorescalemixin#getter-minimalticks)</span>, <span id="getter-scorerulesdrawn">[`scoreRulesDrawn`](../scorescalemixin#getter-scorerulesdrawn)</span>, <span id="getter-scorerules">[`scoreRules`](../scorescalemixin#getter-scorerules)</span></span>

<span data-pagefind-ignore>From [ScoreAxisMixin](../scoreaxismixin): <span id="getter-defaultscoredomain">[`defaultScoreDomain`](../scoreaxismixin#getter-defaultscoredomain)</span>, <span id="getter-valuescales">[`valueScales`](../scoreaxismixin#getter-valuescales)</span>, <span id="getter-autoscalerange">[`autoscaleRange`](../scoreaxismixin#getter-autoscalerange)</span>, <span id="getter-autoscaleddomain">[`autoscaledDomain`](../scoreaxismixin#getter-autoscaleddomain)</span>, <span id="getter-minscorebound">[`minScoreBound`](../scoreaxismixin#getter-minscorebound)</span>, <span id="getter-maxscorebound">[`maxScoreBound`](../scoreaxismixin#getter-maxscorebound)</span>, <span id="getter-hasmanualscorebounds">[`hasManualScoreBounds`](../scoreaxismixin#getter-hasmanualscorebounds)</span>, <span id="getter-axes">[`axes`](../scoreaxismixin#getter-axes)</span></span>

## Actions

<span data-pagefind-ignore>From [ScoreScaleMixin](../scorescalemixin): <span id="action-setscaletype">[`setScaleType`](../scorescalemixin#action-setscaletype)</span>, <span id="action-setscalezero">[`setScaleZero`](../scorescalemixin#action-setscalezero)</span>, <span id="action-setdomainquantile">[`setDomainQuantile`](../scorescalemixin#action-setdomainquantile)</span>, <span id="action-setminscore">[`setMinScore`](../scorescalemixin#action-setminscore)</span>, <span id="action-setmaxscore">[`setMaxScore`](../scorescalemixin#action-setmaxscore)</span>, <span id="action-setautoscalegroup">[`setAutoscaleGroup`](../scorescalemixin#action-setautoscalegroup)</span>, <span id="action-setgrid">[`setGrid`](../scorescalemixin#action-setgrid)</span>, <span id="action-setscorerules">[`setScoreRules`](../scorescalemixin#action-setscorerules)</span></span>
