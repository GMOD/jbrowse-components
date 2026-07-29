---
id: basetrackmodel
title: BaseTrackModel
sidebar_label: Track -> BaseTrackModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseTrackModel.ts).

these MST models only exist for tracks that are _shown_. they should contain
only UI state for the track, and have a reference to a track configuration. note
that multiple displayed tracks could use the same configuration.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal(trackType)</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(baseTrackConfig)</code> |  |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  |
| <span id="property-pinned">**pinned**</span><br><code>pinned: types.stripDefault(types.boolean, false)</code> |  |
| <span id="property-displays">**displays**</span><br><details><summary><code>displays: types.array( pm.pluggableMstType('display', 'stateMod…</code></summary><pre><code>displays: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pm.pluggableMstType('display', 'stateModel') as unknown as IType&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;unknown,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;unknown,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;DisplayModel&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&gt;,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> | The runtime plugin union (`pluggableMstType`) is typed only as `IAnyType`, erasing the element to `any`. Assert the concrete `DisplayModel` instance every registered display satisfies so reads (`activeDisplay`, `trackMenuItems`) are checked; create/snapshot stay `unknown` since the union's snapshot shape is genuinely dynamic (`replaceDisplay` writes a partial snapshot). |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-trackid">**trackId**</span><br><code>string</code> |  |
| <span id="getter-rpcsessionid">**rpcSessionId**</span><br><code>string</code> | determines which webworker to send the track to, currently based on trackId |
| <span id="getter-name">**name**</span><br><code>string</code> |  |
| <span id="getter-textsearchadapter">**textSearchAdapter**</span><br><code>any</code> |  |
| <span id="getter-adapterconfig">**adapterConfig**</span><br><code>any</code> |  |
| <span id="getter-activedisplay">**activeDisplay**</span><br><details><summary><code>DisplayModel &amp; IStateTreeNode&lt;IType&lt;unknown, unknown, DisplayMo…</code></summary><pre><code>DisplayModel &amp; IStateTreeNode&lt;IType&lt;unknown, unknown, DisplayModel&gt;&gt;</code></pre></details> | a shown track always has at least one display |
| <span id="getter-canconfigure">**canConfigure**</span><br><code>boolean</code> |  |
| <span id="getter-adaptertype">**adapterType**</span><br><code>AdapterType</code> |  |
| <span id="getter-savetrackdatamenuitem">**saveTrackDataMenuItem**</span><br><code>MenuItem</code> | the "Save track data" menu entry. Kept separate from trackMenuItems so consumers (e.g. the LGV track-label menu) can place it alongside the session's Settings/Copy/Delete track actions without fishing it back out of the general list |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-savetrackfileformatoptions">**saveTrackFileFormatOptions**</span><br><code>() =&gt; Record&lt;string, FileTypeExporter&gt;</code> |  |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setpinned">**setPinned**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-replacedisplay">**replaceDisplay**</span><br><details><summary><code>(oldDisplayId: string, newDisplayId: string, initialSnapshot?:…</code></summary><pre><code>(oldDisplayId: string, newDisplayId: string, initialSnapshot?: any) =&gt; void</code></pre></details> |  |
| <span id="action-afterattach">**afterAttach**</span><br><code>() =&gt; void</code> | Persist any config-schema mutation (quick track-menu edits calling `setSlot` directly, or the full Settings dialog) back to the session, debounced, mirroring ConfigurationEditorWidget's own save. Both savers intentionally coexist — this one covers direct setSlot edits on a shown track, the widget covers an unshown track edited from the selector (no BaseTrackModel). When both fire they compute an identical delta, deduped in updateTrackConfiguration; don't drop one to "simplify". `reaction` (not `autorun`) on purpose: `self.configuration` is defined immediately on attach, unlike ConfigurationEditorWidget's `target` (which starts undefined), so an autorun's guaranteed first run would otherwise schedule a spurious flush for every track ever shown, even completely untouched ones — `reaction` only fires on an actual change.<br><br>`equals: comparer.structural` is load-bearing, not an optimization: `self.configuration` is a re-resolving reference, and persisting a save swaps the resolved node identity (admin `updateTrackConf` replaces the frozen `jbrowse.tracks` entry, rehydrating a brand-new MST node; the non-admin path reconciles in place but still churns once). Referential comparison would treat every such swap as a fresh change and re-fire the save, which for the admin/desktop path (new node every write) is an unbounded debounced loop. Structural comparison settles once the content stops changing. |
