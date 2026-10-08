---
id: jbrowse1connection
title: JBrowse1Connection
description: "Connection that imports tracks from a legacy JBrowse 1 data directory, composed on the base connection model."
sidebar_label: Connection -> JBrowse1Connection
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `legacy-jbrowse` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/model.ts).

Connection that imports tracks from a legacy JBrowse 1 data directory,
composed on the base connection model.

The configuration slots for this model are documented on its [config schema page](../../config/jbrowse1connection).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('JBrowse1Connection')</code> |  |

<span data-pagefind-ignore>From [BaseConnectionModel](../baseconnectionmodel): <span id="property-tracks">[`tracks`](../baseconnectionmodel#property-tracks)</span>, <span id="property-silent">[`silent`](../baseconnectionmodel#property-silent)</span></span>

## Volatiles

<span data-pagefind-ignore>From [BaseConnectionModel](../baseconnectionmodel): <span id="volatile-loading">[`loading`](../baseconnectionmodel#volatile-loading)</span></span>

## Getters

<span data-pagefind-ignore>From [BaseConnectionModel](../baseconnectionmodel): <span id="getter-connectionid">[`connectionId`](../baseconnectionmodel#getter-connectionid)</span>, <span id="getter-name">[`name`](../baseconnectionmodel#getter-name)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-connect">**connect**</span><br><code>() =&gt; Promise&lt;void&gt;</code> |  |

<span data-pagefind-ignore>From [BaseConnectionModel](../baseconnectionmodel): <span id="action-setloading">[`setLoading`](../baseconnectionmodel#action-setloading)</span>, <span id="action-addtrackconf">[`addTrackConf`](../baseconnectionmodel#action-addtrackconf)</span>, <span id="action-addtrackconfs">[`addTrackConfs`](../baseconnectionmodel#action-addtrackconfs)</span>, <span id="action-settrackconfs">[`setTrackConfs`](../baseconnectionmodel#action-settrackconfs)</span></span>
