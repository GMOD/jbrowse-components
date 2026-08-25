---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
sidebar_label: Connection -> UCSCTrackHubConnection
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/model.ts).

The configuration slots for this model are documented on its
[config schema page](../../config/ucsctrackhubconnection).

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  | UCSCTrackHubConnection |
| <span id="property-type">**type**</span><br><code>type: types.literal('UCSCTrackHubConnection')</code> |  | UCSCTrackHubConnection |
| <span id="property-tracks">**tracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>tracks: types.array(pluginManager.pluggableConfigSchemaType('tr…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))</code></pre></dialog></span> |  | [BaseConnectionModel](../baseconnectionmodel#property-tracks) |
| <span id="property-silent">**silent**</span><br><code>silent: types.optional(types.boolean, false)</code> | <span data-pagefind-ignore>set when the connection is being re-established on session load (its open tracks are already restored from `connectionTrackConfigs`), so `doConnect` suppresses first-connect side effects like launching a view or a success snackbar. Runtime-only: connection instances aren't serialized.</span> | [BaseConnectionModel](../baseconnectionmodel#property-silent) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-loading">**loading**</span><br><code>loading: false</code> | <span data-pagefind-ignore>true while `connect()` is fetching this connection's tracks; drives a loading affordance in the track selector. Distinct from an empty `tracks` array, which is also the state of a connection that loaded successfully but has no tracks.</span> | [BaseConnectionModel](../baseconnectionmodel#volatile-loading) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-connectionid">**connectionId**</span><br><code>string</code> | <span data-pagefind-ignore>the connection's unique id, resolved from its configuration (the config is the source of truth; connection names are not guaranteed unique)</span> | [BaseConnectionModel](../baseconnectionmodel#getter-connectionid) |
| <span id="getter-name">**name**</span><br><code>string</code> |  | [BaseConnectionModel](../baseconnectionmodel#getter-name) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-connect">**connect**</span><br><code>() =&gt; Promise&lt;void&gt;</code> |  | UCSCTrackHubConnection |
| <span id="action-setloading">**setLoading**</span><br><code>(loading: boolean) =&gt; void</code> |  | [BaseConnectionModel](../baseconnectionmodel#action-setloading) |
| <span id="action-addtrackconf">**addTrackConf**</span><br><code>(trackConf: TrackConf) =&gt; any</code> |  | [BaseConnectionModel](../baseconnectionmodel#action-addtrackconf) |
| <span id="action-addtrackconfs">**addTrackConfs**</span><br><code>(trackConfs: TrackConf[]) =&gt; void</code> |  | [BaseConnectionModel](../baseconnectionmodel#action-addtrackconfs) |
| <span id="action-settrackconfs">**setTrackConfs**</span><br><code>(trackConfs: TrackConf[]) =&gt; void</code> |  | [BaseConnectionModel](../baseconnectionmodel#action-settrackconfs) |
