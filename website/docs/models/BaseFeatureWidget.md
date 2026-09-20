---
id: basefeaturewidget
title: BaseFeatureWidget
sidebar_label: Widget -> BaseFeatureWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/BaseFeatureWidget/stateModelFactory.ts).

The feature-details panel. `featureData` is the clicked feature with the
track's and the session's `formatDetails` callbacks applied, derived on read
from the raw feature the widget was opened with, so the same widget follows a
config edit and survives its track being closed.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('BaseFeatureWidget')</code> |  |
| <span id="property-unformattedfeaturedata">**unformattedFeatureData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>unformattedFeatureData: types.optional( types.frozen&lt;MaybeSeria…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>unformattedFeatureData: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;MaybeSerializedFeat&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | the feature as the click handed it over, before any callback ran. Persisted as `featureData` |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-track">**track**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>track: types.safeReference( pluginManager.pluggableMstType('tra…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>track: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-trackid">**trackId**</span><br><code>trackId: types.maybe(types.string)</code> |  |
| <span id="property-tracktype">**trackType**</span><br><code>trackType: types.maybe(types.string)</code> |  |
| <span id="property-sequencefeaturedetails">**sequenceFeatureDetails**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {})</code></pre></dialog></span> |  |
| <span id="property-descriptions">**descriptions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>descriptions: types.optional( types.frozen&lt;Descriptors &#124; undefi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>descriptions: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;Descriptors &#124; undefined&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-parentfeature">**parentFeature**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>parentFeature: types.optional( types.frozen&lt;ParentFeatureSummar…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>parentFeature: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;ParentFeatureSummary &#124; undefined&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | names the feature this one was reached through, when it was reached through one -- a transcript clicked inside its gene |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-sequencehoverposition">**sequenceHoverPosition**</span><br><code>sequenceHoverPosition: undefined</code> | genomic base currently hovered in this widget's sequence panel, read by the LGV crosshair overlay |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-trackconfiguration">**trackConfiguration**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ConfigNodeType&lt;…&gt; &amp; ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTr…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ConfigNodeType&lt;…&gt; &amp; ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></dialog></span> | the config the track tier of `formatDetails` reads. The open track's own while it is open; after it is closed, the session's copy of the same config, which is why the widget records `trackId` |
| <span id="getter-formatdetailstiers">**formatDetailsTiers**</span><br><code>FormatDetailsTiers</code> |  |
| <span id="getter-formatted">**formatted**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ feature?: SimpleFeatureSerialized &#124; undefined; error?: Error…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ feature?: SimpleFeatureSerialized &#124; undefined; error?: Error &#124; undefined; }</code></pre></dialog></span> |  |
| <span id="getter-maxdepth">**maxDepth**</span><br><code>number &#124; undefined</code> | levels of subfeature card the panel renders; unset means no limit |
| <span id="getter-featuredata">**featureData**</span><br><code>SimpleFeatureSerialized &#124; undefined</code> | the feature with every `formatDetails` callback applied |
| <span id="getter-error">**error**</span><br><code>Error &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setsequencehoverposition">**setSequenceHoverPosition**</span><br><code>(pos: SequenceHoverPosition &#124; undefined) =&gt; void</code> |  |
| <span id="action-setfeaturedata">**setFeatureData**</span><br><code>(featureData: SimpleFeatureSerialized) =&gt; void</code> |  |
| <span id="action-clearfeaturedata">**clearFeatureData**</span><br><code>() =&gt; void</code> |  |
