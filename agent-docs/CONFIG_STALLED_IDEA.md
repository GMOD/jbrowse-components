
## Reactivity cleanup



**`ConfigOverrideMixin` reactivity + type safety (blocked, scoped PR
needed).** `configOverrides` is a single
`types.frozen<Record<string, unknown>>()` atom — `setOverride('k', v)`
replaces the whole object, so every consumer that reads any key depends on
every other. Concrete consequence: toggling `showLabels` invalidates
canvas's `rpcProps` (which spreads `displayConfigSnapshot` which spreads
`configOverrides`) and triggers a refetch even when worker output is
label-independent. Same latent issue affects `LDDisplay` (19 overrides),
`MultiSampleVariantBaseModel` (7), alignments — they happen not to feel it
because their overrides do warrant refetches.

Secondary: `getConfWithOverride<T>(key)` is typed by caller assertion —
rename a config field, nothing warns. `DisplayConfig` (canvas) is
hand-maintained to parallel `baseConfigSchema.ts` with no compiler
enforcement.

Directions considered (none landed in derived-layout PR — scope too broad):

- *Per-field typed `*Override` props on one display.* Consistent if every
  override moves; hacky as a partial split.
- *Treat UI-toggle fields as non-config state.* Pull `showLabels` /
  `showDescriptions` out of the schema, plain MST props. Small, fixes the
  canvas-specific issue, breaks admin defaults for those fields.
- *Retire `ConfigOverrideMixin` plugin-wide* in favor of per-field typed
  props with config fallback. Cleanest; cross-plugin.
- *Generate `DisplayConfig` from the schema at the type level*, have
  `getConf` return `unknown` by default — addresses type safety
  independent of reactivity.

Worth a scoped PR picking one of the last two deliberately.
