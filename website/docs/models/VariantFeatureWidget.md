---
id: variantfeaturewidget
title: VariantFeatureWidget
sidebar_label: Widget -> VariantFeatureWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VariantFeatureWidget/stateModelFactory.ts).

Feature-details widget for a VCF variant, extending the base feature widget
with variant-specific fields such as genotypes and INFO.

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('VariantFeatureWidget')</code> |  | VariantFeatureWidget |
| <span id="property-descriptions">**descriptions**</span><br><code>descriptions: types.frozen&lt;Descriptions &#124; undefined&gt;()</code> |  | VariantFeatureWidget |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseFeatureWidget](../basefeaturewidget#property-id) |
| <span id="property-unformattedfeaturedata">**unformattedFeatureData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>unformattedFeatureData: types.optional( types.frozen&lt;MaybeSeria…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>unformattedFeatureData: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;MaybeSerializedFeat&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | <span data-pagefind-ignore>the feature as the click handed it over, before any callback ran. Persisted as `featureData`</span> | [BaseFeatureWidget](../basefeaturewidget#property-unformattedfeaturedata) |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#property-view) |
| <span id="property-track">**track**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>track: types.safeReference( pluginManager.pluggableMstType('tra…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>track: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#property-track) |
| <span id="property-trackid">**trackId**</span><br><code>trackId: types.maybe(types.string)</code> |  | [BaseFeatureWidget](../basefeaturewidget#property-trackid) |
| <span id="property-tracktype">**trackType**</span><br><code>trackType: types.maybe(types.string)</code> |  | [BaseFeatureWidget](../basefeaturewidget#property-tracktype) |
| <span id="property-sequencefeaturedetails">**sequenceFeatureDetails**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {})</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#property-sequencefeaturedetails) |
| <span id="property-parentfeature">**parentFeature**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>parentFeature: types.optional( types.frozen&lt;ParentFeatureSummar…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>parentFeature: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;ParentFeatureSummary &#124; undefined&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | <span data-pagefind-ignore>names the feature this one was reached through, when it was reached through one -- a transcript clicked inside its gene</span> | [BaseFeatureWidget](../basefeaturewidget#property-parentfeature) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-sequencehoverposition">**sequenceHoverPosition**</span><br><code>sequenceHoverPosition: undefined</code> | <span data-pagefind-ignore>genomic base currently hovered in this widget's sequence panel, read by the LGV crosshair overlay</span> | [BaseFeatureWidget](../basefeaturewidget#volatile-sequencehoverposition) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-trackconfiguration">**trackConfiguration**</span><br><code>AnyConfigurationModel &#124; undefined</code> | <span data-pagefind-ignore>the config the track tier of `formatDetails` reads. The open track's own while it is open; after it is closed, the session's copy of the same config, which is why the widget records `trackId`</span> | [BaseFeatureWidget](../basefeaturewidget#getter-trackconfiguration) |
| <span id="getter-formatdetailstiers">**formatDetailsTiers**</span><br><code>FormatDetailsTiers</code> |  | [BaseFeatureWidget](../basefeaturewidget#getter-formatdetailstiers) |
| <span id="getter-formatted">**formatted**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ feature?: SimpleFeatureSerialized &#124; undefined; error?: Error…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ feature?: SimpleFeatureSerialized &#124; undefined; error?: Error &#124; undefined; }</code></pre></dialog></span> |  | [BaseFeatureWidget](../basefeaturewidget#getter-formatted) |
| <span id="getter-maxdepth">**maxDepth**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>levels of subfeature card the panel renders; unset means no limit</span> | [BaseFeatureWidget](../basefeaturewidget#getter-maxdepth) |
| <span id="getter-featuredata">**featureData**</span><br><code>SimpleFeatureSerialized &#124; undefined</code> | <span data-pagefind-ignore>the feature with every `formatDetails` callback applied</span> | [BaseFeatureWidget](../basefeaturewidget#getter-featuredata) |
| <span id="getter-error">**error**</span><br><code>Error &#124; undefined</code> |  | [BaseFeatureWidget](../basefeaturewidget#getter-error) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setsequencehoverposition">**setSequenceHoverPosition**</span><br><code>(pos: SequenceHoverPosition &#124; undefined) =&gt; void</code> |  | [BaseFeatureWidget](../basefeaturewidget#action-setsequencehoverposition) |
| <span id="action-setfeaturedata">**setFeatureData**</span><br><code>(featureData: SimpleFeatureSerialized) =&gt; void</code> |  | [BaseFeatureWidget](../basefeaturewidget#action-setfeaturedata) |
| <span id="action-clearfeaturedata">**clearFeatureData**</span><br><code>() =&gt; void</code> |  | [BaseFeatureWidget](../basefeaturewidget#action-clearfeaturedata) |
