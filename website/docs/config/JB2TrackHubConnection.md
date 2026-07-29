---
id: jb2trackhubconnection
title: JB2TrackHubConnection
sidebar_label: Connection -> JB2TrackHubConnection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/JB2TrackHubConnection/configSchema.ts).

## Overview

### JB2TrackHubConnection - Pre-processor / simplified config

preprocessor to allow minimal config, where `uri` points at the jb2 config.json:

```json
{
  "type": "JB2TrackHubConnection",
  "uri": "https://mysite.com/path/to/config.json"
}
```

## Related links

- **State model:** [runtime API](../../models/jb2trackhubconnection)
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
| <span id="slot-configjsonlocation">**configJsonLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: 'https://mysite.com/path/to/config.json', locationType:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;&#160;&#160;uri: 'https://mysite.com/path/to/config.json',&#10;&#160;&#160;&#160;&#160;locationType: 'UriLocation',&#10;&#160;&#160;}</code></pre></dialog></span> | location of the jb2 config file (usually called config.json) |  |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | optional list of genomes to import from this config.json, if empty all genomes will be imported |  |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'nameOfConnection'</code> | a unique name for this connection | [BaseConnection](../baseconnection) |
