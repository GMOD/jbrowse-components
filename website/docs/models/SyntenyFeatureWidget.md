---
id: syntenyfeaturewidget
title: SyntenyFeatureWidget
description: "The feature-details widget a synteny feature opens, which is BaseFeatureWidget plus the band the click landed in."
sidebar_label: Widget -> SyntenyFeatureWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/SyntenyFeatureDetail/index.ts).

The feature-details widget a synteny feature opens, which is
`BaseFeatureWidget` plus the band the click landed in.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('SyntenyFeatureWidget')</code> |  |

<span data-pagefind-ignore>From [BaseFeatureWidget](../basefeaturewidget): <span id="property-id">[`id`](../basefeaturewidget#property-id)</span>, <span id="property-unformattedfeaturedata">[`unformattedFeatureData`](../basefeaturewidget#property-unformattedfeaturedata)</span>, <span id="property-view">[`view`](../basefeaturewidget#property-view)</span>, <span id="property-track">[`track`](../basefeaturewidget#property-track)</span>, <span id="property-trackid">[`trackId`](../basefeaturewidget#property-trackid)</span>, <span id="property-tracktype">[`trackType`](../basefeaturewidget#property-tracktype)</span>, <span id="property-sequencefeaturedetails">[`sequenceFeatureDetails`](../basefeaturewidget#property-sequencefeaturedetails)</span>, <span id="property-descriptions">[`descriptions`](../basefeaturewidget#property-descriptions)</span>, <span id="property-parentfeature">[`parentFeature`](../basefeaturewidget#property-parentfeature)</span></span>

## Volatiles

<span data-pagefind-ignore>From [BaseFeatureWidget](../basefeaturewidget): <span id="volatile-sequencehoverposition">[`sequenceHoverPosition`](../basefeaturewidget#volatile-sequencehoverposition)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-level">**level**</span><br><code>number &#124; undefined</code> | The band the feature was clicked in, read off the widget's own track so it follows the band when rows are added or removed. Undefined for a synteny track open in a plain linear genome view. |

<span data-pagefind-ignore>From [BaseFeatureWidget](../basefeaturewidget): <span id="getter-trackconfiguration">[`trackConfiguration`](../basefeaturewidget#getter-trackconfiguration)</span>, <span id="getter-formatdetailstiers">[`formatDetailsTiers`](../basefeaturewidget#getter-formatdetailstiers)</span>, <span id="getter-formatted">[`formatted`](../basefeaturewidget#getter-formatted)</span>, <span id="getter-canonicaltranscripts">[`canonicalTranscripts`](../basefeaturewidget#getter-canonicaltranscripts)</span>, <span id="getter-maxdepth">[`maxDepth`](../basefeaturewidget#getter-maxdepth)</span>, <span id="getter-featuredata">[`featureData`](../basefeaturewidget#getter-featuredata)</span>, <span id="getter-error">[`error`](../basefeaturewidget#getter-error)</span></span>

## Actions

<span data-pagefind-ignore>From [BaseFeatureWidget](../basefeaturewidget): <span id="action-setsequencehoverposition">[`setSequenceHoverPosition`](../basefeaturewidget#action-setsequencehoverposition)</span>, <span id="action-setfeaturedata">[`setFeatureData`](../basefeaturewidget#action-setfeaturedata)</span>, <span id="action-clearfeaturedata">[`clearFeatureData`](../basefeaturewidget#action-clearfeaturedata)</span></span>
