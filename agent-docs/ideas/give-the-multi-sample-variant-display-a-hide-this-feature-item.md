---
name: give-the-multi-sample-variant-display-a-hide-this-feature-item
description: `plugins/canvas` has `hideFeature` and the multi-sample variant displays do not, so a single dominating variant cannot be taken out of the picture — a copy of a mechanism that has since moved to `featureSetViews.ts` and `featureContextMenu.ts`
---

# Give the multi-sample variant display a "hide this feature" item

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Parity with another display rather than a setting the
rewrite dropped, which is what kept the tooltip toggle ahead of it on the
release list — that one landed as the `showTooltips` config slot and its
"Show..." checkbox, so this is the entry's remaining half.

`plugins/canvas` has `hideFeature` and the multi-sample variant displays do not,
so a single dominating variant cannot be taken out of the picture the way a
feature can on a basic display.

**The copy target moved.** This entry used to name
`LinearBasicDisplay/baseModel.ts`; as of 2026-08-26 the mechanism is
`LinearBasicDisplay/featureSetViews.ts` and `featureContextMenu.ts`, with
`filters.test.ts`, `narrowings.test.ts` and `trackMenuShape.test.ts` pinning it.
Nothing under `plugins/variants` mentions it.

The tooltip toggle it used to be taken with is done:
`shared/SharedVariantConfigSchema.ts` declares the slot, the base model gates
`hoveredTooltipSource` on it, and `variantShowSubmenuItems` carries the
checkbox — the same three places a "hide this feature" item would land.
