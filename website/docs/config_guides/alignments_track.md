---
title: Alignments track
description: BAM/CRAM track config with BamAdapter and CramAdapter options
guide_category: Track types
---

Example `AlignmentsTrack` config:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "my_alignments_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "https://yourhost/file.bam"
  }
}
```

## BamAdapter configuration options

The `uri` shorthand assumes the index sits next to the data file at `<uri>.bai`.
Spell out the location slots only when the index is named differently or is a
CSI index:

- `bamLocation` - file location of the BAM
- `index.location` - file location of the index
- `index.indexType` - `BAI` (default) or `CSI`

```json
{
  "type": "BamAdapter",
  "bamLocation": { "uri": "https://yourhost/file.bam" },
  "index": {
    "indexType": "CSI",
    "location": { "uri": "https://yourhost/file.bam.csi" }
  }
}
```

See the [BamAdapter config docs](/docs/config/bamadapter) for all options.

## CramAdapter configuration options

The `uri` shorthand assumes the index sits next to the data file at
`<uri>.crai`. The sequence adapter is supplied automatically from the enclosing
assembly, so you do not need to set `sequenceAdapter` manually. Spell out the
location slots only when the index is named differently:

- `cramLocation` - file location of the CRAM
- `craiLocation` - file location of the CRAI

```json
{ "type": "CramAdapter", "uri": "https://yourhost/file.cram" }
```

See the [CramAdapter config docs](/docs/config/cramadapter) for all options.

## Display options

Display settings (`colorBy`, `height`, `featureHeight`, `filterBy`, and the
coverage `autoscale`/`minScore`/`maxScore`) are slots on the
`LinearAlignmentsDisplay`, not on the track. Reads are a solid gray until you
pick a coloring scheme via the
[`colorBy`](/docs/config/linearalignmentsdisplay/#slot-colorby) slot. To change
a default, set it with the track's `displayDefaults` shorthand:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "my_alignments_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "BamAdapter", "uri": "https://yourhost/file.bam" },
  "displayDefaults": { "colorBy": { "type": "pairOrientation" }, "height": 250 }
}
```

The `displayDefaults` object is shorthand. JBrowse applies each setting for you,
so you don't have to know the display's name (`LinearAlignmentsDisplay`) or
write the array. Use the array form when you need per-display control (see the
[track config guide](/docs/config_guides/tracks/#configuring-displays)).

See the
[LinearAlignmentsDisplay config docs](/docs/config/linearalignmentsdisplay) for
the full list of slots. To open a track in a particular state from a link or
embedded view instead of changing the default, see
[applying display settings](/docs/tutorials/display_settings).

## See also

- [Alignments track](/docs/user_guides/alignments_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
