---
id: addtrackmodel
title: AddTrackModel
sidebar_label: Widget -> AddTrackModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/AddTrackWidget/model.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('AddTrackWidget')</code> |  |
| <span id="property-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-trackcontainerid">**trackContainerId**</span><br><code>trackContainerId: types.maybe(types.string)</code> | Which of the view's track containers the new track opens in, by id. Absent — the usual case — means the view itself. See the same property on HierarchicalTrackSelectorWidget, which is what sets this. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-trackcontainer">**trackContainer**</span><br><code>TrackContainer &#124; undefined</code> | The track list a submitted track opens in. |
| <span id="getter-trackadapter">**trackAdapter**</span><br><code>AdapterConfig &#124; undefined</code> |  |
| <span id="getter-trackname">**trackName**</span><br><code>string</code> |  |
| <span id="getter-submittabletrackname">**submittableTrackName**</span><br><code>string</code> | The name the track is added under, which is what an all-whitespace entry has to be judged on — `!!trackName` accepts `' '` and mints a track whose name renders as nothing in the selector. |
| <span id="getter-uris">**uris**</span><br><code>(string &#124; undefined)[]</code> |  |
| <span id="getter-isftp">**isFtp**</span><br><code>boolean</code> |  |
| <span id="getter-isrelativeurl">**isRelativeUrl**</span><br><code>boolean</code> |  |
| <span id="getter-wrongprotocol">**wrongProtocol**</span><br><code>boolean</code> |  |
| <span id="getter-adapterhintnotconfigurable">**adapterHintNotConfigurable**</span><br><code>boolean</code> | Returns true if the user selected an adapter from the dropdown but the extension point couldn't build a config for it |
| <span id="getter-assembly">**assembly**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-trackadaptertype">**trackAdapterType**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-tracktype">**trackType**</span><br><code>string</code> |  |
| <span id="getter-warningmessage">**warningMessage**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>"" &#124; "Warning: JBrowse cannot access files using the ftp protoc…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>"" &#124; "Warning: JBrowse cannot access files using the ftp protocol" &#124; …</code></pre></dialog></span> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-gettrackconfig">**getTrackConfig**</span><br><code>(timestamp: number) =&gt; DraftTrackConfig &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setmixindata">**setMixinData**</span><br><code>(arg: Record&lt;string, unknown&gt;) =&gt; void</code> |  |
| <span id="action-updatebulkinput">**updateBulkInput**</span><br><code>(patch: Partial&lt;BulkInputState&gt;) =&gt; void</code> | Patch the bulk workflow's collected input. A patch rather than a setter per field: the bulk form edits several of these together (removing a row rewrites the input *and* forgets that row's rename). |
| <span id="action-setadapterhint">**setAdapterHint**</span><br><code>(obj: string) =&gt; void</code> |  |
| <span id="action-settextindexingconf">**setTextIndexingConf**</span><br><code>(conf: IndexingAttr) =&gt; void</code> |  |
| <span id="action-settextindextrack">**setTextIndexTrack**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-settrackdata">**setTrackData**</span><br><code>(obj: FileLocation) =&gt; void</code> |  |
| <span id="action-setindextrackdata">**setIndexTrackData**</span><br><code>(obj: FileLocation) =&gt; void</code> |  |
| <span id="action-setdetectedindex">**setDetectedIndex**</span><br><code>(obj: FileLocation, name: string) =&gt; void</code> | Records an index found beside the main file. Ignored when an index is already set, since a probe resolving late must never overwrite one typed while it was in flight. |
| <span id="action-setassembly">**setAssembly**</span><br><code>(str: string) =&gt; void</code> |  |
| <span id="action-settrackname">**setTrackName**</span><br><code>(str: string) =&gt; void</code> |  |
| <span id="action-settracktype">**setTrackType**</span><br><code>(str: string) =&gt; void</code> |  |
| <span id="action-cleardata">**clearData**</span><br><code>() =&gt; void</code> |  |
