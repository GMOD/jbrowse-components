---
name: a-paired-record-draws-its-links-with-no-config
description: since the arc plugin left (ADR-163), arcs for a BEDPE, STAR-Fusion or SV VCF track take a hand-written mark display config — a link mark, an x2 locus and a mate step — where they used to be a display you picked; the mark display's default plot should draw the links itself when the features name a mate
metadata:
  area: marks, variants
  category: ready
  order: 1
  first_move: "in `plugins/marks/src/LinearMarkDisplay/plotFields.ts`, have `defaultPlotMarks` (fed by `scanPlotFields`) return the link mark over a `mate` step when the scanned features carry `mate` or a breakend `ALT`, then load a BEDPE from \"Add a track\", pick the mark display from the track menu, and check the arcs draw with nothing written"
---

# A paired record draws its links with no config

Before ADR-163, loading Hi-C loops was two steps: paste the BEDPE into "Add a
track", then pick the paired-arc display. Now the arc display is gone and the
mark display draws links, but only from a config the user writes by hand:

```json
{
  "type": "LinearMarkDisplay",
  "marks": [
    {
      "mark": "link",
      "encoding": { "x2": { "chrom": "mate.refName", "pos": "mate.start" } },
      "transform": [{ "type": "mate" }]
    }
  ]
}
```

The pieces for a zero-config route are already in place:

- VariantTrack offers `LinearMarkDisplay` in its display menu
  (`plugins/marks/src/LinearMarkDisplay/index.ts`).
- BEDPE and STAR-Fusion features carry `mate`
  (`plugins/bed/src/BedpeAdapter/util.ts`), and a VCF breakend states its mate
  in `ALT`, which the `mate` step reads.
- The default plot is already chosen from the scanned fields; it skips a score
  most features lack, for example.

The missing rule: features that name a mate get the link mark as their default
plot. Once that works, the Hi-C guide's "Overlaying loops and interactions as
arcs" section (`website/docs/user_guides/hic_track.md`) and the Links section of
`website/docs/config_guides/mark_display.md` can say "pick the mark display"
instead of showing the JSON. Thickness by score stays a config
(`encoding.size`) until a menu item earns its place.

Done looks like this: a BEDPE, a STAR-Fusion file and an SV VCF each draw links
from the track menu alone, and a test pins the default plot for each.
