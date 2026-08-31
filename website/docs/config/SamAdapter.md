---
id: samadapter
title: SamAdapter
sidebar_label: Adapter -> SamAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/SamAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'AlignmentsTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'SamAdapter',
    uri: 'https://example.com/sample.sam',
  },
}
```

`sample.sam` infers `SamAdapter` and `AlignmentsTrack` on its own, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/sample.sam',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

plain-text SAM, either a file or an inline string

There is no index, so the whole file is loaded and held in memory — this is
for small files (a BLAT result, a handful of assembled contigs, a test case).
Use BAM or CRAM for anything sequencing-scale.

Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
automatically supplies it from the enclosing assembly's sequence track. It is
what per-base mismatches are computed against for records with no MD tag.

## Related links

- **Track:** [AlignmentsTrack](../alignmentstrack)
- **Display:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "SamAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-samlocation">**samLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.sam', locationType: 'UriLocation' }</code> | location of the SAM file, header lines included. Ignored when `samText` supplies the alignment inline. |
| <span id="slot-samtext">**samText**</span><br>[`text`](/docs/config_guides/slot_types#text) = <code>''</code> | SAM text supplied inline instead of from `samLocation`, header lines included. Takes precedence when set. Lets an alignment produced in the browser — a BLAT hit converted from PSL, for instance — persist in a session without a file behind it. |
