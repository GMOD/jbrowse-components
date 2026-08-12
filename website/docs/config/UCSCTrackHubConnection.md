---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
sidebar_label: Connection -> UCSCTrackHubConnection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/configSchema.ts).

## Example usage

An entry in the config's `connections`. The hub's `hub.txt` is read on connect
and every track it declares for a matching assembly is added to the session —
nothing is written into your config, so the hub stays the source of truth.
`assemblyNames` limits which of the hub's genomes are used.

```js
{
  type: 'UCSCTrackHubConnection',
  connectionId: 'ucsc_hub_example',
  name: 'My track hub',
  assemblyNames: ['hg38'],
  hubTxtLocation: { uri: 'https://example.com/hub.txt' },
}
```

_See the **Config slots** section below for all available configuration fields._

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
| Slot | Description |
| --- | --- |
| <span id="slot-hubtxtlocation">**hubTxtLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: 'https://mysite.com/path/to/hub.txt', locationType: 'Uri…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;&#160;&#160;uri: 'https://mysite.com/path/to/hub.txt',&#10;&#160;&#160;&#160;&#160;locationType: 'UriLocation',&#10;&#160;&#160;}</code></pre></dialog></span> | location of the hub file (usually called hub.txt) |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | optional list of genomes to import from this track hub, if empty all genomes will be imported |
| <span class="slot-group">Inherited from [BaseConnection](../baseconnection)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'nameOfConnection'</code> | a unique name for this connection |
