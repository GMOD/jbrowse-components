---
id: connectionmanagementsessionmixin
title: ConnectionManagementSessionMixin
description: "Adds connections to a session: the connection instances it has made, and the configs of the connection tracks the user opened, so those tracks load on session restore without reconnecting."
sidebar_label: Mixin -> ConnectionManagementSessionMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Connections.ts).

Adds connections to a session: the connection instances it has made, and
the configs of the connection tracks the user opened, so those tracks load
on session restore without reconnecting.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-connectioninstances">**connectionInstances**</span><br><code><a href="../baseconnectionmodel">BaseConnectionModel</a>[]</code> · default <code>[]</code> |  |
| <span id="property-connectiontrackconfigs">**connectionTrackConfigs**</span><br><code>Record&lt;string, ConnectionTrackConfigEntry&gt;</code> · default <code>{}</code> | Persisted configs of connection tracks the user has opened, keyed by trackId. Unlike `connectionInstances` (stripped from snapshots, holds the whole fetched hub), this holds only the tracks in use, so an open connection track resolves synchronously on session load without re-establishing the connection. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-connections">**connections**</span><br><code><a href="../../config/baseconnection">BaseConnectionConfig</a>[]</code> |  |

## Methods

<details class="inherited-members" data-pagefind-ignore open>
<summary>2 inherited methods from one model</summary>

From [ReferenceManagementSessionMixin](../referencemanagementsessionmixin): <span id="method-getreferringmultiple">[`getReferringMultiple`](../referencemanagementsessionmixin#method-getreferringmultiple)</span>, <span id="method-getreferring">[`getReferring`](../referencemanagementsessionmixin#method-getreferring)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-makeconnection">**makeConnection**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(configuration, initialSnapshot?) =&gt; BaseConnectionModel</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(configuration: AnyConfigurationModel, initialSnapshot?: object) =&gt; <a href="../baseconnectionmodel">BaseConnectionModel</a></code></pre></dialog></span> |  |
| <span id="action-breakconnection">**breakConnection**</span><br><code>(configuration: AnyConfigurationModel) =&gt; void</code> | Remove a live connection instance. Tolerant of an already-dormant connection (its instance is stripped from the session on reload). Leaves persisted open-track configs alone — the connect() error path calls this and the user's already-open tracks must survive a transient failure. Full removal goes through `deleteConnection`. |
| <span id="action-teardownconnection">**teardownConnection**</span><br><code>(configuration: AnyConfigurationModel) =&gt; void</code> | Close every track a connection contributed — the live instance's tracks plus any persisted open-track configs (a dormant connection, never expanded this session, still renders its opened tracks from `connectionTrackConfigs`) — from all views/widgets, drop the live instance, and drop the persisted configs. The session is left as if the connection had never loaded. |
| <span id="action-deleteconnection">**deleteConnection**</span><br><code>(configuration: AnyConfigurationModel) =&gt; boolean</code> | Fully remove a connection: tear down its tracks and live instance, then delete its config. |
| <span id="action-addconnectionconf">**addConnectionConf**</span><br><code>(connectionConf: AnyConfiguration) =&gt; <a href="../../config/baseconnection">BaseConnectionConfig</a></code> | Adds to the **config**, not the session: `jbrowse.connections`, which every visitor to this instance loads. jbrowse-web overrides this so a non-admin's connection goes to `sessionConnections` instead — see WebSessionConnectionsMixin, whose `addSessionConnectionConf` adds to the session specifically rather than to "wherever this user's edits go".<br><br>Applications without that override (Desktop, the embedded products) have only this one destination, and it is the right one there: their config and session are saved as a single document. |
| <span id="action-clearconnections">**clearConnections**</span><br><code>() =&gt; void</code> |  |
| <span id="action-captureconnectiontrack">**captureConnectionTrack**</span><br><code>(trackId: string) =&gt; void</code> | Snapshot a just-opened connection track's config into `connectionTrackConfigs` so it survives session reload. No-op if the track isn't connection-provided or is already captured (edits go through `updateConnectionTrackConfig`). |
| <span id="action-updateconnectiontrackconfig">**updateConnectionTrackConfig**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConf: Record&lt;…&gt; &amp; { trackId: string; }) =&gt; void</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConf: Record&lt;string, unknown&gt; &amp; { trackId: string; }) =&gt; void</code></pre></dialog></span> | Persist an edit to an opened connection track. The full config is stored (not a delta): the connection's fetched "base" isn't present at load, so only a complete config resolves synchronously. |
| <span id="action-setconnectiontrackconfig">**setConnectionTrackConfig**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId, connectionId, config) =&gt; void</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, connectionId: string, config: Record&lt;string, unknown&gt;) =&gt; void</code></pre></dialog></span> | Upsert one opened connection track's persisted config. |
| <span id="action-pruneconnectiontrackconfig">**pruneConnectionTrackConfig**</span><br><code>(trackId: string) =&gt; void</code> | Drop a connection track's persisted config once no open view still references it, so the session doesn't accumulate closed tracks. |
| <span id="action-hydrateconnection">**hydrateConnection**</span><br><code>(connectionId: string) =&gt; void</code> | Lazily establish a single connection by id if it isn't already live; the track selector calls it when the connection's category is expanded. Fetches without launching a view or showing a success snackbar; already-open tracks keep rendering from `connectionTrackConfigs` meanwhile. Idempotent. |

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited action from one model</summary>

From [ReferenceManagementSessionMixin](../referencemanagementsessionmixin): <span id="action-dereferencetrack">[`dereferenceTrack`](../referencemanagementsessionmixin#action-dereferencetrack)</span>

</details>
