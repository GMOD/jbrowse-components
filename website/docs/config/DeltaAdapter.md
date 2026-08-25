---
id: deltaadapter
title: DeltaAdapter
sidebar_label: Adapter -> DeltaAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/DeltaAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'DeltaAdapter',
    uri: 'https://example.com/aln.delta',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load MUMmer `.delta` alignment files (query and target assembly
required)

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
- **Display:** [MultiWaySyntenyDisplay](../multiwaysyntenydisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "DeltaAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-deltalocation">**deltaLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/file.delta', locationType: 'UriLocation' }</code> | location of the MUMmer `.delta` file written by `nucmer`/`promer` (also accepts the `delta-filter` output). May be gzipped; the whole file is read into memory. |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second |
| <span id="slot-targetassembly">**targetAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames: the target assembly name |
| <span id="slot-queryassembly">**queryAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames: the query assembly name |
