---
id: cramadapter
title: CramAdapter
sidebar_label: Adapter -> CramAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `alignments`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/CramAdapter/configSchema.ts).

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

_See the **Config slots** section below for all available configuration fields._

used to configure CRAM adapter

Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
automatically supplies it from the enclosing assembly's sequence track.

## Related links

- **Track:** [AlignmentsTrack](../alignmentstrack)
- **Display:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "CramAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3_000_000</code> | size in bytes over which to display a warning to the user that too much data will be fetched<br>_advanced_ |
| <span id="slot-cramlocation">**cramLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.cram', locationType: 'UriLocation' }</code> | location of the CRAM file. CRAM stores each read as differences from the reference it was compressed against, so the assembly's sequence has to be that same reference — pointing this at an assembly built from a different FASTA shows up as widespread false mismatches rather than as an error. |
| <span id="slot-crailocation">**craiLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.cram.crai', locationType: 'UriLocation' }</code> | location of the CRAM index (`.crai`) written by `samtools index`. Only needed when the index is not named `<file>.cram.crai`, which is what the `uri` shorthand assumes. |
