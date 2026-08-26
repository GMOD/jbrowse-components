---
name: let-the-multi-sample-variant-display-turn-tooltips-off
description: a re-add, not a new setting — the rewrite dropped `showTooltips` and the legacy-props comment is the only trace left
metadata:
  area: variants
  category: ready
---

# Let the multi-sample variant display turn tooltips off

`LinearMultiSampleVariantDisplay` has no way to suppress its tooltips. This is a
re-add rather than a new setting: the old `showTooltips` prop went in the
rewrite, and the only mention left in the tree is the legacy-props comment in
`shared/MultiSampleVariantBaseModel.ts` naming it among the keys an old snapshot
may still carry (verified 2026-08-26 — that comment is the sole occurrence).

Take it with
[give-the-multi-sample-variant-display-a-hide-this-feature-item](give-the-multi-sample-variant-display-a-hide-this-feature-item.md):
same display, same menu, and both are copies of something `plugins/canvas`
already has.
