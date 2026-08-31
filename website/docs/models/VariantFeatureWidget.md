---
id: variantfeaturewidget
title: VariantFeatureWidget
sidebar_label: Widget -> VariantFeatureWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`variants` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VariantFeatureWidget/stateModelFactory.ts).

Feature-details widget for a VCF variant, extending the base feature widget with
variant-specific fields such as genotypes and INFO.

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('VariantFeatureWidget')</code> |  | VariantFeatureWidget |
| <span id="property-descriptions">**descriptions**</span><br><code>descriptions: types.frozen&lt;Descriptions &#124; undefined&gt;()</code> |  | VariantFeatureWidget |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseFeatureWidget](../basefeaturewidget#property-id) |
| <span id="property-featuredata">**featureData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>featureData: types.optional( types.frozen&lt;MaybeSerializedFeat&gt;(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>featureData: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;MaybeSerializedFeat&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#property-featuredata) |
| <span id="property-unformattedfeaturedata">**unformattedFeatureData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>unformattedFeatureData: types.optional( types.frozen&lt;MaybeSeria…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>unformattedFeatureData: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;MaybeSerializedFeat&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#property-unformattedfeaturedata) |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#property-view) |
| <span id="property-track">**track**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>track: types.safeReference( pluginManager.pluggableMstType('tra…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>track: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#property-track) |
| <span id="property-trackid">**trackId**</span><br><code>trackId: types.maybe(types.string)</code> |  | [BaseFeatureWidget](../basefeaturewidget#property-trackid) |
| <span id="property-tracktype">**trackType**</span><br><code>trackType: types.maybe(types.string)</code> |  | [BaseFeatureWidget](../basefeaturewidget#property-tracktype) |
| <span id="property-maxdepth">**maxDepth**</span><br><code>maxDepth: types.maybe(types.number)</code> |  | [BaseFeatureWidget](../basefeaturewidget#property-maxdepth) |
| <span id="property-sequencefeaturedetails">**sequenceFeatureDetails**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {})</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#property-sequencefeaturedetails) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-error">**error**</span><br><code>error: undefined</code> |  | [BaseFeatureWidget](../basefeaturewidget#volatile-error) |
| <span id="volatile-sequencehoverposition">**sequenceHoverPosition**</span><br><code>sequenceHoverPosition: undefined</code> | <span data-pagefind-ignore>genomic base currently hovered in this widget's sequence panel, read by the LGV crosshair overlay</span> | [BaseFeatureWidget](../basefeaturewidget#volatile-sequencehoverposition) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setsequencehoverposition">**setSequenceHoverPosition**</span><br><code>(pos: SequenceHoverPosition &#124; undefined) =&gt; void</code> |  | [BaseFeatureWidget](../basefeaturewidget#action-setsequencehoverposition) |
| <span id="action-setfeaturedata">**setFeatureData**</span><br><code>(featureData: SimpleFeatureSerialized) =&gt; void</code> |  | [BaseFeatureWidget](../basefeaturewidget#action-setfeaturedata) |
| <span id="action-clearfeaturedata">**clearFeatureData**</span><br><code>() =&gt; void</code> |  | [BaseFeatureWidget](../basefeaturewidget#action-clearfeaturedata) |
| <span id="action-setformatteddata">**setFormattedData**</span><br><code>(feat: SimpleFeatureSerialized) =&gt; void</code> |  | [BaseFeatureWidget](../basefeaturewidget#action-setformatteddata) |
| <span id="action-settrackinfo">**setTrackInfo**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(type?: string &#124; undefined, trackId?: string &#124; undefined) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(type?: string &#124; undefined, trackId?: string &#124; undefined) =&gt; void</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#action-settrackinfo) |
| <span id="action-setmaxdepth">**setMaxDepth**</span><br><code>(maxDepth?: number &#124; undefined) =&gt; void</code> |  | [BaseFeatureWidget](../basefeaturewidget#action-setmaxdepth) |
| <span id="action-seterror">**setError**</span><br><code>(e: unknown) =&gt; void</code> |  | [BaseFeatureWidget](../basefeaturewidget#action-seterror) |
