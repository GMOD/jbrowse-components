---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
sidebar_label: Connection -> UCSCTrackHubConnection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/configSchema.ts).

## Overview

### UCSCTrackHubConnection - Pre-processor / simplified config

preprocessor to allow minimal config, where `uri` points at the hub.txt:

```json
{
  "type": "UCSCTrackHubConnection",
  "uri": "https://mysite.com/path/to/hub.txt"
}
```

## Related links

- **State model:** [runtime API](../../models/ucsctrackhubconnection)
- **Base config:** [BaseConnection](../baseconnection)

## Config slots

These slots are top-level fields of the connection's entry in `connections`.
Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-hubtxtlocation">**hubTxtLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <details><summary><code>{ uri: 'https://mysite.com/path/to/hub.txt', locationType: 'Uri…</code></summary><pre><code>{&#10;&#160;&#160;&#160;&#160;uri: 'https://mysite.com/path/to/hub.txt',&#10;&#160;&#160;&#160;&#160;locationType: 'UriLocation',&#10;&#160;&#160;}</code></pre></details> | location of the hub file (usually called hub.txt) |  |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | optional list of genomes to import from this track hub, if empty all genomes will be imported |  |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'nameOfConnection'</code> | a unique name for this connection | [BaseConnection](../baseconnection) |
