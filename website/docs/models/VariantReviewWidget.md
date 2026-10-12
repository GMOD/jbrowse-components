---
id: variantreviewwidget
title: VariantReviewWidget
sidebar_label: Widget -> VariantReviewWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `variant-review` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variant-review/src/VariantReviewWidget/model.ts).

The review drawer. It holds only which view it is for and reads everything
else off that view, so closing it loses nothing.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('VariantReviewWidget')</code> |  |
| <span id="property-view">**view**</span><br><code>view: types.maybe(types.string)</code> | the id of the LinearGenomeView under review |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-reviewview">**reviewView**</span><br><code>VariantReviewView &#124; undefined</code> | the view, or undefined when it has closed or is not a reviewing LinearGenomeView |
| <span id="getter-reviewableviews">**reviewableViews**</span><br><code>VariantReviewView[]</code> | the LinearGenomeViews this widget could review in, for the picker |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setview">**setView**</span><br><code>(viewId: string) =&gt; void</code> |  |
