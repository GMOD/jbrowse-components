---
name: give-the-multi-sample-variant-display-a-hide-this-feature-item
description: `plugins/features` has `hideFeature` and `LinearVariantDisplay` does not, so a single dominating variant cannot be taken out of the picture; the copy is `featureSetViews.ts` and `featureContextMenu.ts` plus a worker-side id filter in the cell fetch.
---

# Give LinearVariantDisplay a "hide this feature" item

Moved out of [TODO.md](../../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Parity with another display rather than a setting the
rewrite dropped, which is what kept the tooltip toggle ahead of it on the
release list — that one landed as the `tooltip.show` config slot and its
"Show..." checkbox, so this is the entry's remaining half.

`plugins/features` has `hideFeature` and `LinearVariantDisplay` does not,
so a single dominating variant cannot be taken out of the picture the way a
feature can on a basic display.

**The copy target moved.** This entry used to name
`LinearBasicDisplay/baseModel.ts`; as of 2026-08-26 the mechanism is
`LinearBasicDisplay/featureSetViews.ts` and `featureContextMenu.ts`, with
`filters.test.ts`, `narrowings.test.ts` and `trackMenuShape.test.ts` pinning it.
Nothing under `plugins/variants` mentions it.

The tooltip toggle it used to be taken with is done:
`LinearVariantDisplay/configSchema.ts` declares the slot, the model's
`showTooltips` getter gates `hoveredTooltipSource` on it, and
`variantShowSubmenuItems` (`variantDisplayMenuItems.ts`) carries the
checkbox — the same three places a "hide this feature" item would land.

**Since ADR-255 (one `LinearVariantDisplay`)** a right-clicked record on the
records band takes plugin-features's zoom to, get sequence, copy, read sort and
Highlight items, but not LinearBasicDisplay's Show/hide rows (pin, show only,
hide). Hiding wants the record out of the genotype cells as well as the band,
so it needs a worker-side id filter in the cell fetch.
