- audit docs more
- regenerate embedded examples
- check malonge question
- fix tests
- remove LinearReadCloudDisplay, LinearReadArcsDisplay from docs...or restore them in reduced form?

- tricky business to double check


The effective config for non-wiggle track still works test was throwing width undefined, make sure to check for model.initialized.

Root cause: buildDisplayEntry in packages/core/src/util/getConfigOverrides.ts read each display override via toJS(display[key]) — evaluating the resolved model getter. The showLabels config slot collides with the display model's showLabels getter (baseModel.ts:270), which resolves a view-dependent boolean by reading visibleFeatureDensityPerPx → visibleRegions → dynamicBlocks → width. In a test the view isn't initialized, so width throws.

This was also a latent correctness bug: even in production, "Copy config" would emit the resolved boolean showLabels: true/false instead of the actual showLabels enum override.

Fix: Read overrides from the source of truth — the display's configOverrides map via getOverride(key) (from ConfigOverrideMixin) — instead of evaluating resolved model getters. This both fixes the crash and the enum-vs-boolean bug, and falls back to "no overrides" for displays that don't compose the mixin.
