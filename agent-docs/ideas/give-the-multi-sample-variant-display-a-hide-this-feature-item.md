---
name: give-the-multi-sample-variant-display-a-hide-this-feature-item
description: `plugins/canvas` has `hideFeature` and the multi-sample variant displays do not, so a single dominating variant cannot be taken out of the picture — a copy of a mechanism that has since moved to `featureSetViews.ts` and `featureContextMenu.ts`
---

# Give the multi-sample variant display a "hide this feature" item

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Parity with another display rather than a setting the
rewrite dropped, which is what keeps the tooltip toggle beside it on the
release list.

`plugins/canvas` has `hideFeature` and the multi-sample variant displays do not,
so a single dominating variant cannot be taken out of the picture the way a
feature can on a basic display.

**The copy target moved.** This entry used to name
`LinearBasicDisplay/baseModel.ts`; as of 2026-08-26 the mechanism is
`LinearBasicDisplay/featureSetViews.ts` and `featureContextMenu.ts`, with
`filters.test.ts`, `narrowings.test.ts` and `trackMenuShape.test.ts` pinning it.
Nothing under `plugins/variants` mentions it.

Take it with
[let-the-multi-sample-variant-display-turn-tooltips-off](../todo/let-the-multi-sample-variant-display-turn-tooltips-off.md).
