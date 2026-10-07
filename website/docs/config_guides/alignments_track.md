---
title: Alignments track
description: BAM/CRAM track config with BamAdapter and CramAdapter options
guide_category: Track types
---

Point an `AlignmentsTrack` at a BAM or CRAM with the `uri` shorthand and the
index resolves automatically. Coloring, height, and filtering are slots on the
`LinearAlignmentsDisplay`, set via `displayDefaults`.

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "my_alignments_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "BamAdapter", "uri": "https://yourhost/file.bam" },
  "displayDefaults": { "color": { "field": "pairOrientation" }, "height": 250 }
}
```

- **The `uri` shorthand resolves the index** (`.bai` for a BAM, `.crai` for a
  CRAM); add `"csi": true` for a CSI-indexed BAM
  ([the `uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand))
- **CRAM decodes against the reference**, and both adapters take their
  `sequenceAdapter` from the enclosing assembly, so the track names none
  ([](/docs/config/bamadapter), [](/docs/config/cramadapter))
- **`color`, `height`, `featureHeight`, `filter` and the coverage band's
  `scales.y`** are
  [`LinearAlignmentsDisplay`](/docs/config/linearalignmentsdisplay) slots. Reads
  draw gray with mismatches marked until
  [`color`](/docs/config/linearalignmentsdisplay/#slot-color) names a field —
  `strand`, `pairOrientation`, `insertSize` or `tags.XX` — and
  [`baseColor`](/docs/config/linearalignmentsdisplay/#slot-basecolor) draws
  modifications or base quality over them; the
  [cookbook](/docs/cookbook#alignments-tracks) has the coloring, grouping and
  flag-filter recipe
- **[`unit`](/docs/config/linearalignmentsdisplay/#slot-unit) says what one row
  stands for**, a read or a chain of a read with its mate and split segments;
  [`facet`](/docs/config/linearalignmentsdisplay/#slot-facet) stacks one
  labelled section per value of a read field (`pairOrientation`, `tags.HP`); and
  [`arcColor`](/docs/config/linearalignmentsdisplay/#slot-arccolor) picks the
  pair field the read-connection arcs paint when it is not the reads'

[Applying display settings](/docs/tutorials/display_settings) opens a track in a
given state from a link or an embedded view.

## See also

- [](/docs/user_guides/alignments_track)
- [](/docs/config_guides/grouping_and_ordering)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
