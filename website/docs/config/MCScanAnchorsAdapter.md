---
id: mcscananchorsadapter
title: MCScanAnchorsAdapter
sidebar_label: Adapter -> MCScanAnchorsAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanAnchorsAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'MCScanAnchorsAdapter',
    uri: 'https://example.com/data.anchors',
    bed1: 'https://example.com/query.bed',
    bed2: 'https://example.com/target.bed',
    assemblyNames: ['hg19', 'hg38'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load MCScan (jcvi) `.anchors` files with their two BED files

See the [MCScan anchors tutorial](/docs/tutorials/mcscan_synteny), which also
covers converting an MCScanX run into these files.

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "MCScanAnchorsAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri`, `bed1`, `bed2`, `chromSizes`, `csi`, `nhUri` in place of writing a
location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in
the [config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-mcscananchorslocation">**mcscanAnchorsLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/mcscan.anchors', locationType: 'UriLocation' }</code> |  |
| <span id="slot-bed1location">**bed1Location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/file.bed', locationType: 'UriLocation' }</code> |  |
| <span id="slot-bed2location">**bed2Location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/file.bed', locationType: 'UriLocation' }</code> |  |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> |  |
