---
id: baseconnection
title: BaseConnection
sidebar_label: Connection -> BaseConnection
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/baseConnectionConfig.ts).

:::caution Gotcha

A connection config is only a pointer: the hub's track list is fetched when the connection loads and held in memory, and is **not** written into a saved or shared session. Only a track you actually open is stored (under `connectionTrackConfigs`, keyed by `trackId`), which is what keeps a shared session small even against a very large hub.

:::

## Overview

### BaseConnection - Identifier

Every BaseConnection has a unique `connectionId`, a required top-level field that identifies it (not one of the config slots below).

## Related links

- **Extended by:** [JB2TrackHubConnection](../jb2trackhubconnection)
- **Extended by:** [JBrowse1Connection](../jbrowse1connection)
- **Extended by:** [UCSCTrackHubConnection](../ucsctrackhubconnection)

## Config slots

`BaseConnection` is a shared base schema, not a type you name in a config. Set these slots on one of the configs under **Extended by** above, each of which lists them as inherited and shows the shape in its own example. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'nameOfConnection'</code> | a unique name for this connection |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | optional list of names of assemblies in this connection |
