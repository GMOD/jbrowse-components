---
title: Alignments track
description: BAM/CRAM track config with BamAdapter and CramAdapter options
guide_category: Track types
---

**TL;DR:** point an `AlignmentsTrack` at a BAM or CRAM with the `uri` shorthand
and the index resolves automatically. Coloring, height, and filtering are slots
on the `LinearAlignmentsDisplay`, set via `displayDefaults`.

Example `AlignmentsTrack` config:

```json addtrack
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
`<uri>.crai` for a CRAM), so most tracks need nothing else. Add `"csi": true`
alongside `uri` for a CSI-indexed BAM. See
[the `uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand) for when
to spell out the location slots, and when CSI is required.

CRAM decodes against the reference sequence; both adapters take their
`sequenceAdapter` from the enclosing assembly automatically.

See the [](/docs/config/bamadapter) and [](/docs/config/cramadapter) config docs
for all options.

## Display options

Display settings (`colorBy`, `height`, `featureHeight`, `filterBy`, and the
coverage `autoscale`/`minScore`/`maxScore`) are slots on the
`LinearAlignmentsDisplay`. By default every read is drawn the same gray with its
mismatches marked;
[`colorBy`](/docs/config/linearalignmentsdisplay/#slot-colorby) colors the reads
by strand, pair orientation, insert size, a tag, and so on. Set one with the
track's
[`displayDefaults` shorthand](/docs/config_guides/tracks/#configuring-displays):

```json addtrack
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
embedded view, see
[applying display settings](/docs/tutorials/display_settings).

## See also

- [](/docs/user_guides/alignments_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
