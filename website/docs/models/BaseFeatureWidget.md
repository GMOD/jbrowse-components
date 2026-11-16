---
id: basefeaturewidget
title: BaseFeatureWidget
description: "The feature-details panel."
sidebar_label: Widget -> BaseFeatureWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/BaseFeatureWidget/stateModelFactory.ts).

The feature-details panel. `featureData` is the clicked feature with the
track's and the session's `formatDetails` callbacks applied, derived on read
from the raw feature the widget was opened with, so the same widget follows a
config edit and survives its track being closed.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>string</code> · default <code>createElementId()</code> | The identifier references to this node resolve through. A snapshot that leaves it out gets a generated one. |
| <span id="property-type">**type**</span><br><code>"BaseFeatureWidget"</code> | Always `"BaseFeatureWidget"`, the name a snapshot selects this model by. |
| <span id="property-unformattedfeaturedata">**unformattedFeatureData**</span><br><code>MaybeSerializedFeat</code> · default <code>undefined</code> | the feature as the click handed it over, before any callback ran. Persisted as `featureData` |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>BaseViewModel &amp; Pick&lt;…&gt; &#124; undefined</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code><a href="../baseviewmodel">BaseViewModel</a> &amp; Pick&lt;AbstractViewModel, "assemblyNames" &#124; "regionHost" &#124; "trackContainerFor" &#124; "trackContainers" &#124; "type"&gt; &#124; undefined</code></pre></dialog></span> |  |
| <span id="property-track">**track**</span><br><code>TrackModelOf&lt;DisplayModel&gt; &#124; undefined</code> |  |
| <span id="property-trackid">**trackId**</span><br><code>string &#124; undefined</code> |  |
| <span id="property-tracktype">**trackType**</span><br><code>string &#124; undefined</code> |  |
| <span id="property-sequencefeaturedetails">**sequenceFeatureDetails**</span><br><code><a href="../sequencefeaturedetails">SequenceFeatureDetails</a></code> · default <code>{}</code> |  |
| <span id="property-descriptions">**descriptions**</span><br><code>Descriptors &#124; undefined</code> · default <code>undefined</code> |  |
| <span id="property-parentfeature">**parentFeature**</span><br><code>ParentFeatureSummary &#124; undefined</code> · default <code>undefined</code> | names the feature this one was reached through, when it was reached through one -- a transcript clicked inside its gene |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-sequencehoverposition">**sequenceHoverPosition**</span><br><code>SequenceHoverPosition &#124; undefined</code> | genomic base currently hovered in this widget's sequence panel, read by the LGV crosshair overlay |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-trackconfiguration">**trackConfiguration**</span><br><code>TrackConfigModel &#124; undefined</code> | the config the track tier of `formatDetails` reads. The open track's own while it is open; after it is closed, the session's copy of the same config, which is why the widget records `trackId` |
| <span id="getter-formatdetailstiers">**formatDetailsTiers**</span><br><code>FormatDetailsTiers</code> |  |
| <span id="getter-formatted">**formatted**</span><br><code>{ feature?: SimpleFeatureSerialized; error?: Error; }</code> |  |
| <span id="getter-canonicaltranscripts">**canonicalTranscripts**</span><br><code>CanonicalTranscripts</code> | the isoform tags the open track's display ranks by, so the sequence panel opens on the transcript the track draws first |
| <span id="getter-maxdepth">**maxDepth**</span><br><code>number &#124; undefined</code> | levels of subfeature card the panel renders; unset means no limit |
| <span id="getter-featuredata">**featureData**</span><br><code>SimpleFeatureSerialized &#124; undefined</code> | the feature with every `formatDetails` callback applied, or the raw feature when a callback throws |
| <span id="getter-error">**error**</span><br><code>Error &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setsequencehoverposition">**setSequenceHoverPosition**</span><br><code>(pos: SequenceHoverPosition &#124; undefined) =&gt; void</code> |  |
| <span id="action-setfeaturedata">**setFeatureData**</span><br><code>(featureData: SimpleFeatureSerialized) =&gt; void</code> |  |
| <span id="action-clearfeaturedata">**clearFeatureData**</span><br><code>() =&gt; void</code> |  |
