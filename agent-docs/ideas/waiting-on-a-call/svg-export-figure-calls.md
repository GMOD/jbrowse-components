---
name: svg-export-figure-calls
description: "Figure-quality calls left by the 2026-11 SVG export audit, both parked: indel colors with no key, pale small-chromosome ribbons."
---

# SVG export figure calls

Each item below is a visible property of an exported figure that an audit of
every view's and display's export found in 2026-11, and that changes what a
figure looks like for everyone. None is a defect with one right answer, so each
waits on Colin. The defects from the same audit landed; what they changed is in
[SVG_EXPORT.md](../../reference/SVG_EXPORT.md).

The evidence images are `products/jbrowse-img/img/*.png` and the goldens in
`products/jbrowse-web/src/tests/__image_snapshots__/`.

**Default synteny coloring paints indels with no key.** With no color field
set, insertions are yellow and deletions blue (`colorUtils.ts`), and
`hasColorKey(undefined)` is false, so neither the screen nor the export draws
a key. The audit described `hosted_synteny.png` as mostly blue and yellow
streaks; rendered on 2026-11-25 at both the pre-fix and current commits it is
all match-colored, so find a figure that shows the wedges before keying them. Commit
3f0c2e0c2a chose no key so a constant `value` color would not get a "match"
chip; that reason does not cover the default scheme, where the wedge colors
carry meaning. The proposal keys the indel chips when the field is unset and
indels are drawn. It moves the ggjbrowse legend.

**Small chromosomes' ribbons nearly vanish.** In `hs1_mm39_synteny.png` and
`hg38_hs1_mm39_synteny.png` the chromosomes past about chr17 take the
palette's pale tints, which at `encoding.opacity` 0.4 over the white ground
are barely visible. A palette question, not an export one: rendered at
`encoding.opacity` 0.8 the pale chromosomes stay pale while the rest turn heavy.