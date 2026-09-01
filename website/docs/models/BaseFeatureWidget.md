---
id: basefeaturewidget
title: BaseFeatureWidget
sidebar_label: Widget -> BaseFeatureWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/BaseFeatureWidget/stateModelFactory.ts).

displays data about features, allowing configuration callbacks to modify the
contents of what is displayed

see: formatDetails-\>feature,formatDetails-\>subfeatures

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('BaseFeatureWidget')</code> |  |
| <span id="property-featuredata">**featureData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>featureData: types.optional( types.frozen&lt;MaybeSerializedFeat&gt;(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>featureData: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;MaybeSerializedFeat&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-unformattedfeaturedata">**unformattedFeatureData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>unformattedFeatureData: types.optional( types.frozen&lt;MaybeSeria…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>unformattedFeatureData: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;MaybeSerializedFeat&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-track">**track**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>track: types.safeReference( pluginManager.pluggableMstType('tra…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>track: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-trackid">**trackId**</span><br><code>trackId: types.maybe(types.string)</code> |  |
| <span id="property-tracktype">**trackType**</span><br><code>trackType: types.maybe(types.string)</code> |  |
| <span id="property-maxdepth">**maxDepth**</span><br><code>maxDepth: types.maybe(types.number)</code> |  |
| <span id="property-sequencefeaturedetails">**sequenceFeatureDetails**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {})</code></pre></dialog></span> |  |
| <span id="property-descriptions">**descriptions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>descriptions: types.optional( types.frozen&lt;Descriptors &#124; undefi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>descriptions: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;Descriptors &#124; undefined&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-error">**error**</span><br><code>error: undefined</code> |  |
| <span id="volatile-sequencehoverposition">**sequenceHoverPosition**</span><br><code>sequenceHoverPosition: undefined</code> | genomic base currently hovered in this widget's sequence panel, read by the LGV crosshair overlay |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setsequencehoverposition">**setSequenceHoverPosition**</span><br><code>(pos: SequenceHoverPosition &#124; undefined) =&gt; void</code> |  |
| <span id="action-setfeaturedata">**setFeatureData**</span><br><code>(featureData: SimpleFeatureSerialized) =&gt; void</code> |  |
| <span id="action-clearfeaturedata">**clearFeatureData**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setformatteddata">**setFormattedData**</span><br><code>(feat: SimpleFeatureSerialized) =&gt; void</code> |  |
| <span id="action-settrackinfo">**setTrackInfo**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(type?: string &#124; undefined, trackId?: string &#124; undefined) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(type?: string &#124; undefined, trackId?: string &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-setmaxdepth">**setMaxDepth**</span><br><code>(maxDepth?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-seterror">**setError**</span><br><code>(e: unknown) =&gt; void</code> |  |
