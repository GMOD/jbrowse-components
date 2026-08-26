---
id: alignmentscontactadapter
title: AlignmentsContactAdapter
sidebar_label: Adapter -> AlignmentsContactAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/AlignmentsContactAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'HicTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'AlignmentsContactAdapter',
    channel: 'sameStrand',
    subadapter: {
      type: 'BamAdapter',
      uri: 'https://example.com/sample.bam',
    },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

builds a contact matrix live from a BAM/CRAM instead of a `.hic` file, so an SV
signature (Cue's contact map) can be looked at without running juicer. Contacts
are computed from the reads in the current view, like the pileup, so this is a
zoomed-in track rather than a whole-genome one

## Related links

- **Track:** [HicTrack](../hictrack)
- **Display:** [LinearHicDisplay](../linearhicdisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "AlignmentsContactAdapter", ... }`. This adapter has no
`uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it
the location slots below. Slot types (`fileLocation`, `frozen`, ...) are
explained in the [config slot types reference](/docs/config_guides/slot_types).
Slots a base configuration contributes are listed here too, so this table is the
whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-subadapter">**subadapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | the alignments adapter the contacts are computed from — a `BamAdapter` or `CramAdapter` config, written the same way it would be on an `AlignmentsTrack` |
| <span id="slot-channel">**channel**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (discordant, sameStrand, outward, depthDifference) = <code>'discordant'</code> | which signature the matrix carries. `discordant` is every pair whose mates are at least `minSpan` apart plus every split-read segment; `sameStrand` is the LL/RR inversion signature; `outward` is the RL eversion signature; `depthDifference` is \|depth[a] − depth[b]\| over bin pairs, which is the plaid Cue's read-depth channel draws |
| <span id="slot-minspan">**minSpan**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1000</code> | how far apart in bp a pair's mates must be for `discordant` to count it. The default clears an ordinary library's insert size — the 2x148 300x genome this was measured on has a p99 insert of 849 bp — so what is left is the pairs an SV put there |
| <span id="slot-binsizes">**binSizes**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[750, 1500, 5000, 25000]</code> | bin sizes the display offers as resolutions, finest first. It picks one from the current zoom the same way it picks a `.hic` file's, and `resolutionBias` steps it |
