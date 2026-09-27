---
name: scales-and-colour-keys
description: "What the 2026-09-26 scales.y and colour-key round left open: synteny range on ramps, a context submenu shut by the read's late rows, and the red clip strip Colin chose for bars past the top of an axis"
---

## Open

- **Synteny ramps take no `range`, `scheme` or pinned ends.** `SyntenyColor`
  and `RibbonColor` declare none of them, the three presets carry fixed stops
  and domains (`continuousRampConfig` in
  `packages/synteny-core/src/colorRamps.ts`), and a numeric column is viridis
  over the span seen. The route a 2026-09-27 review sized at about a day: the
  shared `colorRampSlots` and `colorDomainEndsSlots`, the presets as
  `FieldPresets`, and `resolveContinuousMode` building its stops and domain
  with core's ramp helpers, while the accumulated span stays view-level. It
  reaches the linear synteny view, the dotplot, the circular chords and the
  multi-way display.
- **A context submenu opened before the read's own rows arrive is shut.**
  `alignments_sort_by_base` captured "SNP/Mismatch" closed until its spec
  waited for the app to settle after the right-click. A user who hovers the
  submenu within that round trip meets the same close. Unconfirmed whether
  `CascadingMenu` (`39c60067c5`) or the menu's rebuild does it.
- **The red clip strip**, on wiggle, the coverage band and render-core's
  `bar`: see grammar-next-steps.
