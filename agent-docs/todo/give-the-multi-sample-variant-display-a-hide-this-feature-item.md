---
name: give-the-multi-sample-variant-display-a-hide-this-feature-item
description: copy `plugins/canvas`'s `hideFeature`, which lives in featureSetViews.ts and featureContextMenu.ts rather than the baseModel this entry used to name
metadata:
  area: variants
  category: ready
---

# Give the multi-sample variant display a "hide this feature" item

`plugins/canvas` has `hideFeature` and the multi-sample variant displays do not,
so a single dominating variant cannot be taken out of the picture the way a
feature can on a basic display.

**The copy target moved.** This entry used to name
`LinearBasicDisplay/baseModel.ts`; as of 2026-08-26 the mechanism is
`LinearBasicDisplay/featureSetViews.ts` and `featureContextMenu.ts`, with
`filters.test.ts`, `narrowings.test.ts` and `trackMenuShape.test.ts` pinning it.
Nothing under `plugins/variants` mentions it.

Take it with
[let-the-multi-sample-variant-display-turn-tooltips-off](let-the-multi-sample-variant-display-turn-tooltips-off.md).
