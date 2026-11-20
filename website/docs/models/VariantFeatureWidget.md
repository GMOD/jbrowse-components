---
id: variantfeaturewidget
title: VariantFeatureWidget
description: "Feature-details widget for a VCF variant, extending the base feature widget with variant-specific fields such as genotypes and INFO."
sidebar_label: Widget -> VariantFeatureWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VariantFeatureWidget/stateModelFactory.ts).

Feature-details widget for a VCF variant, extending the base feature widget
with variant-specific fields such as genotypes and INFO.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>"VariantFeatureWidget"</code> | Always `"VariantFeatureWidget"`, the name a snapshot selects this model by. |
| <span id="property-descriptions">**descriptions**</span><br><code>Descriptions &#124; undefined</code> |  |
| <span id="property-triocalls">**trioCalls**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ childGenotype: string &#124; undefined; … }[] &#124; undefined</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ childGenotype: string &#124; undefined; fatherGenotype: string &#124; undefined; motherGenotype: string &#124; undefined; call: TrioClass &#124; undefined; child: string; father?: string; mother?: string; sex?: PedigreeSex; }[] &#124; undefined</code></pre></dialog></span> | Each trio's Mendelian check at the record, which the variant display classifies from the full record when it opens the widget. |

<details class="inherited-members" data-pagefind-ignore>
<summary>8 inherited properties from one model</summary>

From [BaseFeatureWidget](../basefeaturewidget): <span id="property-id">[`id`](../basefeaturewidget#property-id)</span>, <span id="property-unformattedfeaturedata">[`unformattedFeatureData`](../basefeaturewidget#property-unformattedfeaturedata)</span>, <span id="property-view">[`view`](../basefeaturewidget#property-view)</span>, <span id="property-track">[`track`](../basefeaturewidget#property-track)</span>, <span id="property-trackid">[`trackId`](../basefeaturewidget#property-trackid)</span>, <span id="property-tracktype">[`trackType`](../basefeaturewidget#property-tracktype)</span>, <span id="property-sequencefeaturedetails">[`sequenceFeatureDetails`](../basefeaturewidget#property-sequencefeaturedetails)</span>, <span id="property-parentfeature">[`parentFeature`](../basefeaturewidget#property-parentfeature)</span>

</details>

## Volatiles

<details class="inherited-members" data-pagefind-ignore open>
<summary>1 inherited volatile from one model</summary>

From [BaseFeatureWidget](../basefeaturewidget): <span id="volatile-sequencehoverposition">[`sequenceHoverPosition`](../basefeaturewidget#volatile-sequencehoverposition)</span>

</details>

## Getters

<details class="inherited-members" data-pagefind-ignore open>
<summary>7 inherited getters from one model</summary>

From [BaseFeatureWidget](../basefeaturewidget): <span id="getter-trackconfiguration">[`trackConfiguration`](../basefeaturewidget#getter-trackconfiguration)</span>, <span id="getter-formatdetailstiers">[`formatDetailsTiers`](../basefeaturewidget#getter-formatdetailstiers)</span>, <span id="getter-formatted">[`formatted`](../basefeaturewidget#getter-formatted)</span>, <span id="getter-canonicaltranscripts">[`canonicalTranscripts`](../basefeaturewidget#getter-canonicaltranscripts)</span>, <span id="getter-maxdepth">[`maxDepth`](../basefeaturewidget#getter-maxdepth)</span>, <span id="getter-featuredata">[`featureData`](../basefeaturewidget#getter-featuredata)</span>, <span id="getter-error">[`error`](../basefeaturewidget#getter-error)</span>

</details>

## Actions

<details class="inherited-members" data-pagefind-ignore open>
<summary>3 inherited actions from one model</summary>

From [BaseFeatureWidget](../basefeaturewidget): <span id="action-setsequencehoverposition">[`setSequenceHoverPosition`](../basefeaturewidget#action-setsequencehoverposition)</span>, <span id="action-setfeaturedata">[`setFeatureData`](../basefeaturewidget#action-setfeaturedata)</span>, <span id="action-clearfeaturedata">[`clearFeatureData`](../basefeaturewidget#action-clearfeaturedata)</span>

</details>
