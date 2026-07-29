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
| <span id="property-view">**view**</span><br><details><summary><code>view: types.safeReference( pluginManager.pluggableMstType('view…</code></summary><pre><code>view: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('view', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-trackadapter">**trackAdapter**</span><br><code>AdapterConfig &#124; undefined</code> |  |
| <span id="getter-trackname">**trackName**</span><br><code>string</code> |  |
| <span id="getter-uris">**uris**</span><br><code>(string &#124; undefined)[]</code> |  |
| <span id="getter-isftp">**isFtp**</span><br><code>boolean</code> |  |
| <span id="getter-isrelativeurl">**isRelativeUrl**</span><br><code>boolean</code> |  |
| <span id="getter-wrongprotocol">**wrongProtocol**</span><br><code>boolean</code> |  |
| <span id="getter-adapterhintnotconfigurable">**adapterHintNotConfigurable**</span><br><code>boolean</code> | Returns true if the user selected an adapter from the dropdown but the extension point couldn't build a config for it |
| <span id="getter-assembly">**assembly**</span><br><code>any</code> |  |
| <span id="getter-trackadaptertype">**trackAdapterType**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-tracktype">**trackType**</span><br><code>string</code> |  |
| <span id="getter-warningmessage">**warningMessage**</span><br><details><summary><code>"" &#124; "Warning: JBrowse cannot access files using the ftp protoc…</code></summary><pre><code>"" &#124; "Warning: JBrowse cannot access files using the ftp protocol" &#124; …</code></pre></details> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-gettrackconfig">**getTrackConfig**</span><br><code>(timestamp: number) =&gt; { [x: string]: ...; } &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setmixindata">**setMixinData**</span><br><code>(arg: Record&lt;string, unknown&gt;) =&gt; void</code> |  |
| <span id="action-setadapterhint">**setAdapterHint**</span><br><code>(obj: string) =&gt; void</code> |  |
| <span id="action-settextindexingconf">**setTextIndexingConf**</span><br><code>(conf: IndexingAttr) =&gt; void</code> |  |
| <span id="action-settextindextrack">**setTextIndexTrack**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-settrackdata">**setTrackData**</span><br><code>(obj: FileLocation) =&gt; void</code> |  |
| <span id="action-setindextrackdata">**setIndexTrackData**</span><br><code>(obj: FileLocation) =&gt; void</code> |  |
| <span id="action-setassembly">**setAssembly**</span><br><code>(str: string) =&gt; void</code> |  |
| <span id="action-settrackname">**setTrackName**</span><br><code>(str: string) =&gt; void</code> |  |
| <span id="action-settracktype">**setTrackType**</span><br><code>(str: string) =&gt; void</code> |  |
| <span id="action-cleardata">**clearData**</span><br><code>() =&gt; void</code> |  |
