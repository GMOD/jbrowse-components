---
id: pafadapter
title: PAFAdapter
sidebar_label: Adapter -> PAFAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PAFAdapter/configSchema.ts).

## Example usage

A PAF has no index, but it needs the query and target assembly names (query
first):

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/aln.paf',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

:::caution Gotcha

`assemblyNames` is `[query, target]`, which is the **reverse** of the order
minimap2 and nucmer take their inputs (`minimap2 target.fa query.fa`). Getting
it backwards silently draws every alignment against the wrong assembly rather
than erroring. Set the named `queryAssembly` and `targetAssembly` fields instead
and the ordering can't be misread.

:::

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
- **Display:** [MultiWaySyntenyDisplay](../multiwaysyntenydisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "PAFAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-paflocation">**pafLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/file.paf', locationType: 'UriLocation' }</code> | location of the PAF file (minimap2, wfmash, and similar). May be gzipped. There is no index, so the whole alignment is read into memory — convert anything large with `jbrowse make-pif` and use the `PairwiseIndexedPAFAdapter` instead. |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>[]</code> | Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second |
| <span id="slot-targetassembly">**targetAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames: the target assembly name |
| <span id="slot-queryassembly">**queryAssembly**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Alternative to assemblyNames: the query assembly name |
