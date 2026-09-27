---
name: scales-and-colour-keys
description: "What the 2026-09-26 scales.y and colour-key round left open: the coverage and ADR-181 figure reshoots, the alignments read-colour key's title and labels, and a marker for bars clipped at the top of an axis"
---

## Open

- **Reshoot figures with a coverage band.** The 0.99 default changes any
  window with a spike; nothing was reshot.
- **Reshoot the ADR-181 figures**, where a point moved to the middle of its
  extent or a lane became a rule: `mark_display_examples/points`,
  `read_marks/insert_size`, `read_marks/chromosome` and
  `dog10k-size-fst-scan-igf1`. ada refused ssh at the landing.
- **Alignments read colours** take no `title` or `labels` yet. A reviewer's
  recommended direction, not yet put to Colin, who wants the reads-and-arcs
  merge kept since it exists to keep the key small:
  - `title` heads the reads alone, and a merged section reads
    `<title> and arc colors` (`mergedTitle` in
    `plugins/alignments/src/shared/legendUtils.ts` must not lowercase user
    text); under a ramp it titles `reads-ramp`. Read it in its own getter, not
    through `colorSettingOf`, which feeds the baked scale and would re-bake the
    reads on a text edit.
  - `labels` reach buckets through the walk `declaredReadCategoryColors`
    already uses (`READ_COLOR_LEVELS`, `levelOrder` in `alignmentsColor.ts`),
    shared rather than copied, and apply as the top layer of
    `readCategoryLabelOverrides`, `getArcLegendItems`, the connection curves and
    the arc hover; group-by chips keep theirs. Tag values map through the
    written `domain`, not `bakedColorScale`'s copy, which drops `''`.
    Threshold bins take one per interval, as wiggle's do.
  - The colour merge folds the arcs' grey Normal row into a read row of that
    grey (No HP value, MAPQ unavailable), so a label there names normal arcs
    too; and `legendWidth.test.ts` measures only the built-in labels.
- **A marker for bars clipped at the top of an axis**, on wiggle and the
  coverage band, so a clipped bar does not read as its value. A visual call:
  show Colin a picture before building it across GPU, Canvas2D and SVG.
