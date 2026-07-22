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

## Adapter options

The `uri` shorthand above resolves the index for you (`<uri>.bai` for a BAM,
`<uri>.crai` for a CRAM), so most tracks need nothing else. The
[`uri` shorthand section](/docs/config_guides/file_types#the-uri-shorthand)
covers when to spell out the location slots instead, such as a CSI-indexed BAM:

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

CRAM decodes against the reference sequence, but you do not configure that. Both
adapters take their `sequenceAdapter` from the enclosing assembly automatically.

See the [BamAdapter](/docs/config/bamadapter) and
[CramAdapter](/docs/config/cramadapter) config docs for all options.

## Display options

Display settings (`colorBy`, `height`, `featureHeight`, `filterBy`, and the
coverage `autoscale`/`minScore`/`maxScore`) are slots on the
`LinearAlignmentsDisplay`, not on the track. Reads are a solid gray until you
pick a coloring scheme via the
[`colorBy`](/docs/config/linearalignmentsdisplay/#slot-colorby) slot. To change
a default, set it with the track's
[`displayDefaults` shorthand](/docs/config_guides/tracks/#configuring-displays):

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

See the
[LinearAlignmentsDisplay config docs](/docs/config/linearalignmentsdisplay) for
the full list of slots. To open a track in a particular state from a link or
embedded view instead of changing the default, see
[applying display settings](/docs/tutorials/display_settings).

## See also

- [Alignments track](/docs/user_guides/alignments_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
