---
id: htsgetbamadapter
title: HtsgetBamAdapter
sidebar_label: Adapter -> HtsgetBamAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/HtsgetBamAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'AlignmentsTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'HtsgetBamAdapter',
    htsgetBase: 'https://htsget.example.com/reads/',
    htsgetTrackId: 'NA12878',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Used to fetch data from Htsget endpoints in BAM format, using the gmod/bam library

## Related links

- **Track:** [AlignmentsTrack](../alignmentstrack)
- **Display:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "HtsgetBamAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-htsgetbase">**htsgetBase**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the base URL to fetch from |
| <span id="slot-htsgettrackid">**htsgetTrackId**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the trackId, which is appended to the base URL |
