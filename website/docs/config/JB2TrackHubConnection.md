---
id: jb2trackhubconnection
title: JB2TrackHubConnection
sidebar_label: Connection -> JB2TrackHubConnection
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `data-management` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/JB2TrackHubConnection/configSchema.ts).

## Example usage

An entry in the config's `connections`, pointing at another JBrowse 2
`config.json`. Its tracks — and any assemblies it declares that the session
lacks — are added on connect, so one instance can publish a track set that
others subscribe to.

```js
{
  type: 'JB2TrackHubConnection',
  connectionId: 'jb2_hub_example',
  name: 'Shared JBrowse 2 tracks',
  assemblyNames: ['hg38'],
  configJsonLocation: { uri: 'https://example.com/jbrowse/config.json' },
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **State model:** [runtime API](../../models/jb2trackhubconnection)
- **Base config:** [BaseConnection](../baseconnection)

## Config slots

These slots are top-level fields of the connection's entry in `connections`. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-configjsonlocation">**configJsonLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: 'https://mysite.com/path/to/config.json', locationType:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;&#160;&#160;uri: 'https://mysite.com/path/to/config.json',&#10;&#160;&#160;&#160;&#160;locationType: 'UriLocation',&#10;&#160;&#160;}</code></pre></dialog></span> | location of the jb2 config file (usually called config.json) |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | optional list of genomes to import from this config.json, if empty all genomes will be imported |
| <span class="slot-group">Inherited from [BaseConnection](../baseconnection)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'nameOfConnection'</code> | a unique name for this connection |
