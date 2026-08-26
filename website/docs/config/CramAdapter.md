---
id: cramadapter
title: CramAdapter
sidebar_label: Adapter -> CramAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/CramAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.crai` index:
```js
{
  type: 'AlignmentsTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'CramAdapter',
    uri: 'https://example.com/sample.cram',
  },
}
```

`sample.cram` infers `CramAdapter` and `AlignmentsTrack` on its own, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/sample.cram',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

`sequenceAdapter` is filled in automatically from the enclosing assembly's
sequence track — you never specify it.

Reads CRAM alignments, fetching only the containers overlapping the visible
region through the `.crai` index. Decoding happens against that assembly's
sequence, so it has to be the reference the file was compressed against; a
mismatched one isn't rejected, it just decodes into mismatches.

## Related links

- **Track:** [AlignmentsTrack](../alignmentstrack)
- **Display:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "CramAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5_000_000</code> | size in bytes over which to display a warning to the user that too much data will be fetched<br>_advanced_ |
| <span id="slot-usesliceworkerpool">**useSliceWorkerPool**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | decode CRAM slices on a pool of workers rather than in the thread that asked<br>_advanced_ |
| <span id="slot-cramlocation">**cramLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.cram', locationType: 'UriLocation' }</code> | location of the CRAM file |
| <span id="slot-crailocation">**craiLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.cram.crai', locationType: 'UriLocation' }</code> | location of the CRAM index (`.crai`). Only needed when it is not named `<file>.cram.crai`, which is what the `uri` shorthand assumes. |
