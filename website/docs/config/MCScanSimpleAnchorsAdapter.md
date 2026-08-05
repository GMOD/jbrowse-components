---
id: mcscansimpleanchorsadapter
title: MCScanSimpleAnchorsAdapter
sidebar_label: Adapter -> MCScanSimpleAnchorsAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanSimpleAnchorsAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'MCScanSimpleAnchorsAdapter',
    uri: 'https://example.com/data.anchors.simple',
    bed1: 'https://example.com/query.bed',
    bed2: 'https://example.com/target.bed',
    assemblyNames: ['hg19', 'hg38'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load MCScan (jcvi) `.anchors.simple` files with their two BED files

See the [MCScan anchors tutorial](/docs/tutorials/mcscan_synteny), which also
covers converting an MCScanX run into these files.

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "MCScanSimpleAnchorsAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri`, `bed1`, `bed2`, `chromSizes`, `csi`, `nhUri` in place of writing a
location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in
the [config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-mcscansimpleanchorslocation">**mcscanSimpleAnchorsLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/mcscan.anchors.simple', locationType: 'UriLoca…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/mcscan.anchors.simple', locationType: 'UriLocation' }</code></pre></dialog></span> |  |
| <span id="slot-bed1location">**bed1Location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/file.bed', locationType: 'UriLocation' }</code> |  |
| <span id="slot-bed2location">**bed2Location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/file.bed', locationType: 'UriLocation' }</code> |  |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> |  |
