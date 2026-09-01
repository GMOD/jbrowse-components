---
id: bamadapter
title: BamAdapter
sidebar_label: Adapter -> BamAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/BamAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.bai` index (pass `csi: true` for a
`.csi` index). For a differently-named index, set `index` explicitly with
the full slot form:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BamAdapter',
    uri: 'https://example.com/sample.bam',
  },
}
```

`sample.bam` infers `BamAdapter` and `AlignmentsTrack` on its own, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/sample.bam',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

used to configure BAM adapter

Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
automatically supplies it from the enclosing assembly's sequence track.

## Related links

- **Track:** [AlignmentsTrack](../alignmentstrack)
- **Display:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "BamAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `csi` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-bamlocation">**bamLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bam', locationType: 'UriLocation' }</code> | location of the BAM file. Per-base mismatches come from the record's MD tag when it has one, and are otherwise computed against the assembly's reference sequence. |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (BAI, CSI) = <code>'BAI'</code> | `BAI` is the usual `samtools index` output. `CSI` is required for a reference longer than 512 Mb, which BAI cannot address. |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bam.bai', locationType: 'UriLocation' }</code> | location of the index. Only needed when it is not named `<file>.bam.bai` (or `.bam.csi`), which is what the `uri` shorthand assumes. |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5_000_000</code> | size to fetch in bytes over which to display a warning to the user that too much data will be fetched<br>_advanced_ |
