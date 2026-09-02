---
title: Alignments track
description: BAM/CRAM track config with BamAdapter and CramAdapter options
guide_category: Track types
---

**TL;DR:** point an `AlignmentsTrack` at a BAM or CRAM with the `uri` shorthand
and the index resolves automatically. Coloring, height, and filtering are slots
on the `LinearAlignmentsDisplay`, set via `displayDefaults`.

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

- **The `uri` shorthand resolves the index** (`.bai` for a BAM, `.crai` for a
  CRAM); add `"csi": true` for a CSI-indexed BAM
  ([the `uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand))
- **CRAM decodes against the reference**, and both adapters take their
  `sequenceAdapter` from the enclosing assembly, so the track names none
  ([](/docs/config/bamadapter), [](/docs/config/cramadapter))
- **`colorBy`, `height`, `featureHeight`, `filterBy` and the coverage
  `autoscale`/`minScore`/`maxScore`** are
  [`LinearAlignmentsDisplay`](/docs/config/linearalignmentsdisplay) slots. Reads
  draw gray with mismatches marked until
  [`colorBy`](/docs/config/linearalignmentsdisplay/#slot-colorby) colors them by
  strand, pair orientation, insert size or a tag; the
  [cookbook](/docs/cookbook#alignments-tracks) has the coloring, grouping and
  flag-filter recipe

[Applying display settings](/docs/tutorials/display_settings) opens a track in a
given state from a link or an embedded view.

## See also

- [](/docs/user_guides/alignments_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
