---
id: connectionmanagementsessionmixin
title: ConnectionManagementSessionMixin
sidebar_label: Mixin -> ConnectionManagementSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Connections.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-connectioninstances">**connectionInstances**</span><br><details><summary><code>connectionInstances: types.stripDefault( types.array(pluginMana…</code></summary><pre><code>connectionInstances: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(pluginManager.pluggableMstType('connection', 'stateModel')),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  |
| <span id="property-connectiontrackconfigs">**connectionTrackConfigs**</span><br><details><summary><code>connectionTrackConfigs: types.stripDefault( types.frozen&lt;Record…</code></summary><pre><code>connectionTrackConfigs: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;Record&lt;string, ConnectionTrackConfigEntry&gt;&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{},&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> | Persisted configs of connection tracks the user has opened, keyed by trackId. Unlike `connectionInstances` (stripped from snapshots, holds the whole fetched hub), this holds only the tracks in use, so an open connection track resolves synchronously on session load without re-establishing the connection. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-connections">**connections**</span><br><details><summary><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></summary><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></details> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-makeconnection">**makeConnection**</span><br><details><summary><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNod…</code></summary><pre><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, initialSnapshot?: any) =&gt; any</code></pre></details> |  |
| <span id="action-breakconnection">**breakConnection**</span><br><details><summary><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slot…</code></summary><pre><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;…&gt;) =&gt; void</code></pre></details> | Remove a live connection instance. Tolerant of an already-dormant connection (its instance is stripped from the session on reload). Leaves persisted open-track configs alone — the connect() error path calls this and the user's already-open tracks must survive a transient failure. Full removal goes through `deleteConnection`. |
| <span id="action-teardownconnection">**teardownConnection**</span><br><details><summary><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slot…</code></summary><pre><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;…&gt;) =&gt; void</code></pre></details> | Close every track a connection contributed — the live instance's tracks plus any persisted open-track configs (a dormant connection, never expanded this session, still renders its opened tracks from `connectionTrackConfigs`) — from all views/widgets, drop the live instance, and drop the persisted configs. The session is left as if the connection had never loaded. |
| <span id="action-deleteconnection">**deleteConnection**</span><br><details><summary><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slot…</code></summary><pre><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;) =&gt; any</code></pre></details> | Fully remove a connection: tear down its tracks and live instance, then delete its config. |
| <span id="action-addconnectionconf">**addConnectionConf**</span><br><details><summary><code>(connectionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slo…</code></summary><pre><code>(connectionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;…&gt;) =&gt; any</code></pre></details> |  |
| <span id="action-clearconnections">**clearConnections**</span><br><code>() =&gt; void</code> |  |
| <span id="action-captureconnectiontrack">**captureConnectionTrack**</span><br><code>(trackId: string) =&gt; void</code> | Snapshot a just-opened connection track's config into `connectionTrackConfigs` so it survives session reload. No-op if the track isn't connection-provided or is already captured (edits go through `updateConnectionTrackConfig`). |
| <span id="action-updateconnectiontrackconfig">**updateConnectionTrackConfig**</span><br><details><summary><code>(trackConf: Record&lt;string, unknown&gt; &amp; { trackId: string; }) =&gt;…</code></summary><pre><code>(trackConf: Record&lt;string, unknown&gt; &amp; { trackId: string; }) =&gt; void</code></pre></details> | Persist an edit to an opened connection track. The full config is stored (not a delta): the connection's fetched "base" isn't present at load, so only a complete config resolves synchronously. |
| <span id="action-setconnectiontrackconfig">**setConnectionTrackConfig**</span><br><details><summary><code>(trackId: string, connectionId: string, config: Record&lt;string,…</code></summary><pre><code>(trackId: string, connectionId: string, config: Record&lt;string, unknown&gt;) =&gt; void</code></pre></details> | Upsert one opened connection track's persisted config. |
| <span id="action-pruneconnectiontrackconfig">**pruneConnectionTrackConfig**</span><br><code>(trackId: string) =&gt; void</code> | Drop a connection track's persisted config once no open view still references it, so the session doesn't accumulate closed tracks. |
| <span id="action-hydrateconnection">**hydrateConnection**</span><br><code>(connectionId: string) =&gt; void</code> | Lazily establish a single connection by id if it isn't already live — used when its category is expanded in the track selector. Fetches silently (no view launch / success snackbar); already-open tracks keep rendering from `connectionTrackConfigs` meanwhile. Idempotent. |
