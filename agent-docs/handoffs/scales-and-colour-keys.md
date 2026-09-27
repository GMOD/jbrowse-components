---
name: scales-and-colour-keys
description: "What the 2026-09-26 scales.y and colour-key round left open: color.value recolouring normal arcs, synteny range on ramps, two figures the coverage reshoot held back, and the red clip strip Colin chose for bars past the top of an axis"
---

## Open

- **`color.value` recolours normal arcs.** `buildColorPaletteFromPalette`
  writes `value` over `colorPairLR`, the neutral slot five read buckets, the
  arc band's baseline and the linked-read LR curves all read, so it also
  paints normal arcs and LR reads under `pairOrientation`. Sashimi reads the
  theme's `pairLR` and ignores it. The slot's docs say `value` paints a read
  no field paints and one with no value, and `declaredCategoryColors.test.ts`
  pins that read colours reach the arcs only where both paint one field. The
  fix is `value` as a declared colour on `plain` and `noTagValue` in
  `plugins/alignments/src/shared/alignmentsColor.ts`, leaving `colorPairLR`
  the theme's. No test pins the current reach; `a9269202e5` introduced it.
- **Synteny ramps take no `range`, `scheme` or pinned ends.** `SyntenyColor`
  declares none of them, the three presets carry fixed stops and domains
  (`continuousRampConfig` in `packages/synteny-core/src/colorRamps.ts`), and a
  numeric column is viridis over the span seen. `TrackColorsMixin` already
  applies `domain` and `range` to text columns at the read; the same pass
  over numeric spans and presets would reach `resolveContinuousMode` and the
  key, and the dotplot with them. About half a day.
- **Two coverage figures were held back from the 2026-09-27 reshoot.**
  `alignments_sort_by_base` captures without its "SNP/Mismatch → Sort by base
  at position" submenu open, so its callout boxes empty space.
  `sv_channels` gained a "No orientation" lane that the frame cuts off; it
  needs a taller viewport first.
- **The red clip strip**, on wiggle, the coverage band and render-core's
  `bar`: see grammar-next-steps.
