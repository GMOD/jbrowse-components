---
id: basetrackmodel
title: BaseTrackModel
sidebar_label: Track -> BaseTrackModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseTrackModel.ts).

these MST models only exist for tracks that are *shown*. they should contain
only UI state for the track, and have a reference to a track configuration.
note that multiple displayed tracks could use the same configuration.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal(trackType)</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(baseTrackConfig)</code> |  |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  |
| <span id="property-pinned">**pinned**</span><br><code>pinned: types.stripDefault(types.boolean, false)</code> |  |
| <span id="property-displays">**displays**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>displays: types.array( pm.pluggableMstType('display', 'stateMod…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>displays: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pm.pluggableMstType('display', 'stateModel') as unknown as IType&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;unknown,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;unknown,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;DisplayModel&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&gt;,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | The runtime plugin union (`pluggableMstType`) is typed only as `IAnyType`, erasing the element to `any`. Assert the concrete `DisplayModel` instance every registered display satisfies so reads (`activeDisplay`, `trackMenuItems`) are checked; create/snapshot stay `unknown` since the union's snapshot shape is genuinely dynamic (`replaceDisplay` writes a partial snapshot). |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-trackid">**trackId**</span><br><code>string</code> |  |
| <span id="getter-rpcsessionid">**rpcSessionId**</span><br><code>string</code> | determines which webworker to send the track to, currently based on trackId |
| <span id="getter-name">**name**</span><br><code>string</code> |  |
| <span id="getter-textsearchadapter">**textSearchAdapter**</span><br><code>any</code> | this track's own name-search index, from the `textSearching` sub-config. `undefined` when the track has none.<br><br>The path, not a bare `'textSearchAdapter'`: the slot is `textSearching.textSearchAdapter` (`baseTrackConfig.ts`), and a bare read of a name no schema declares returns `undefined` and reports nothing at any layer, so this getter answered `undefined` for every track ever configured with one. `TextSearchManager` reads the same slot by hand-walking `conf.textSearching.textSearchAdapter`, which is why nothing noticed. |
| <span id="getter-adapterconfig">**adapterConfig**</span><br><code>Record&lt;string, unknown&gt;</code> |  |
| <span id="getter-activedisplay">**activeDisplay**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>DisplayModel &amp; IStateTreeNode&lt;IType&lt;unknown, unknown, DisplayMo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>DisplayModel &amp; IStateTreeNode&lt;IType&lt;unknown, unknown, DisplayModel&gt;&gt;</code></pre></dialog></span> | a shown track always has at least one display |
| <span id="getter-canconfigure">**canConfigure**</span><br><code>boolean</code> |  |
| <span id="getter-refnamemismatch">**refNameMismatch**</span><br><code>RefNameMismatch &#124; undefined</code> | Set when this track's file and one of its assemblies share no reference name at all — the `1/2/3` file loaded against a `chr1/chr2/chr3` assembly, which otherwise draws an empty track and says nothing.<br><br>The verdict is reached in `loadRefNameMap`, which is the only place both name sets are in scope, and recorded on the *assembly* because nothing in the assembly manager can reach a track (the session is a sibling subtree, so `getSession` from there finds only the root). The lookup inverts that: the record is keyed by adapter cache key, which is exactly what `rpcSessionId` already is, so a track finds its own with no plumbing in between.<br><br>The names come from `getConfAssemblyNamesOrNone`, not from a raw `assemblyNames` slot read: this model is shared by every track type, and `ReferenceSequenceTrack`'s schema does not declare that slot — it names its assembly by being the `sequence` of one. A raw read there returns `undefined` with no diagnostic at any layer, so the getter was inert for that one track type while looking like it worked. The `OrNone` half is what keeps this total: it runs on every render of every track label, and an unanswerable question must not become a thrown getter.<br><br>Diagnostic only. It gates nothing, and a track carrying one still loads, still fetches and still draws whatever it can. |
| <span id="getter-adaptertype">**adapterType**</span><br><code>AdapterType</code> |  |
| <span id="getter-exportsdataviaadapter">**exportsDataViaAdapter**</span><br><code>boolean</code> | Whether this track's adapter writes an export format itself, rather than the save dialog rebuilding one out of rendered features. A claim about the adapter type, not about a given format — the fetch still falls back when the adapter declines the one that was asked for. |
| <span id="getter-exportbytelimit">**exportByteLimit**</span><br><code>number</code> | What "Save track data" may pull before it asks. The adapter's own `fetchSizeLimit` where it declares one, so a save does not quietly disagree with the size this track's display already refuses to render; otherwise a default. Deliberately generous — unlike the display's gate this is a confirmation rather than a refusal, and the user asked for these bytes by name. |
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
| <span id="action-replacedisplay">**replaceDisplay**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(oldDisplayId: string, newDisplayId: string, initialSnapshot?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(oldDisplayId: string, newDisplayId: string, initialSnapshot?: any) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-afterattach">**afterAttach**</span><br><code>() =&gt; void</code> | Persist any config-schema mutation (quick track-menu edits calling `setSlot` directly, or the full Settings dialog) back to the session, debounced, mirroring ConfigurationEditorWidget's own save. Both savers intentionally coexist — this one covers direct setSlot edits on a shown track, the widget covers an unshown track edited from the selector (no BaseTrackModel). When both fire they compute an identical delta, deduped in updateTrackConfiguration; don't drop one to "simplify". `reaction` (not `autorun`) on purpose: `self.configuration` is defined immediately on attach, unlike ConfigurationEditorWidget's `target` (which starts undefined), so an autorun's guaranteed first run would otherwise schedule a spurious flush for every track ever shown, even completely untouched ones — `reaction` only fires on an actual change.<br><br>`equals: compareStructural` is load-bearing, not an optimization: `self.configuration` is a re-resolving reference, and persisting a save swaps the resolved node identity (admin `updateTrackConf` replaces the frozen `jbrowse.tracks` entry, rehydrating a brand-new MST node; the non-admin path reconciles in place but still churns once). Referential comparison would treat every such swap as a fresh change and re-fire the save, which for the admin/desktop path (new node every write) is an unbounded debounced loop. Structural comparison settles once the content stops changing. |
