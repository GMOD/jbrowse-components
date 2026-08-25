---
id: baseconnectionmodel
title: BaseConnectionModel
sidebar_label: Connection -> BaseConnectionModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseConnectionModelFactory.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-tracks">**tracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>tracks: types.array(pluginManager.pluggableConfigSchemaType('tr…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))</code></pre></dialog></span> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |
| <span id="property-silent">**silent**</span><br><code>silent: types.optional(types.boolean, false)</code> | set when the connection is being re-established on session load (its open tracks are already restored from `connectionTrackConfigs`), so `doConnect` suppresses first-connect side effects like launching a view or a success snackbar. Runtime-only: connection instances aren't serialized. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-loading">**loading**</span><br><code>loading: false</code> | true while `connect()` is fetching this connection's tracks; drives a loading affordance in the track selector. Distinct from an empty `tracks` array, which is also the state of a connection that loaded successfully but has no tracks. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-connectionid">**connectionId**</span><br><code>string</code> | the connection's unique id, resolved from its configuration (the config is the source of truth; connection names are not guaranteed unique) |
| <span id="getter-name">**name**</span><br><code>string</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-connect">**connect**</span><br><code>() =&gt; Promise&lt;void&gt;</code> | no-op hook; concrete connections (UCSC/JB2 track hubs, etc.) override this to fetch and populate their `tracks`. Returns a promise so `afterAttach` can clear the loading flag once the fetch settles. |
| <span id="action-setloading">**setLoading**</span><br><code>(loading: boolean) =&gt; void</code> |  |
| <span id="action-addtrackconf">**addTrackConf**</span><br><code>(trackConf: TrackConf) =&gt; any</code> |  |
| <span id="action-addtrackconfs">**addTrackConfs**</span><br><code>(trackConfs: TrackConf[]) =&gt; void</code> |  |
| <span id="action-settrackconfs">**setTrackConfs**</span><br><code>(trackConfs: TrackConf[]) =&gt; void</code> |  |
