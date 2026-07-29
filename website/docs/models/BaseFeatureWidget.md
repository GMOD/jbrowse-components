---
id: basefeaturewidget
title: BaseFeatureWidget
sidebar_label: Widget -> BaseFeatureWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/BaseFeatureWidget/stateModelFactory.ts).

displays data about features, allowing configuration callbacks to modify the
contents of what is displayed

see: formatDetails-\>feature,formatDetails-\>subfeatures

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('BaseFeatureWidget')</code> |  |
| <span id="property-featuredata">**featureData**</span><br><details><summary><code>featureData: types.optional( types.frozen&lt;MaybeSerializedFeat&gt;(…</code></summary><pre><code>featureData: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;MaybeSerializedFeat&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  |
| <span id="property-unformattedfeaturedata">**unformattedFeatureData**</span><br><details><summary><code>unformattedFeatureData: types.optional( types.frozen&lt;MaybeSeria…</code></summary><pre><code>unformattedFeatureData: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;MaybeSerializedFeat&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  |
| <span id="property-view">**view**</span><br><details><summary><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></summary><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  |
| <span id="property-track">**track**</span><br><details><summary><code>track: types.safeReference( pluginManager.pluggableMstType('tra…</code></summary><pre><code>track: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  |
| <span id="property-trackid">**trackId**</span><br><code>trackId: types.maybe(types.string)</code> |  |
| <span id="property-tracktype">**trackType**</span><br><code>trackType: types.maybe(types.string)</code> |  |
| <span id="property-maxdepth">**maxDepth**</span><br><code>maxDepth: types.maybe(types.number)</code> |  |
| <span id="property-sequencefeaturedetails">**sequenceFeatureDetails**</span><br><details><summary><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(…</code></summary><pre><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {})</code></pre></details> |  |
| <span id="property-descriptions">**descriptions**</span><br><details><summary><code>descriptions: types.optional( types.frozen&lt;Record&lt;string, unkno…</code></summary><pre><code>descriptions: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;Record&lt;string, unknown&gt; &#124; undefined&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  |

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
| <span id="action-setextra">**setExtra**</span><br><details><summary><code>(type?: string &#124; undefined, trackId?: string &#124; undefined, maxDe…</code></summary><pre><code>(type?: string &#124; undefined, trackId?: string &#124; undefined, maxDepth?: number &#124; undefined) =&gt; void</code></pre></details> |  |
| <span id="action-seterror">**setError**</span><br><code>(e: unknown) =&gt; void</code> |  |
