import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * The config slots a display owes `RegionTooLargeMixin` — the byte budget the
 * gate spends, and the declarative way to switch the gate off.
 *
 * A table beside the mixin, for the reason `packages/tree-sidebar/CLAUDE.md`
 * gives for `RowHeightMixin` + `rowHeightConfigSchemaFields`: a mixin's slots
 * live with the mixin, so a display composing it declares them by spreading one
 * thing. This mixin was the exception — it read both slots off
 * `baseLinearDisplayConfigSchema`, which most of its composers extend and five
 * do not (the wiggle family, the two GC-content displays that inherit wiggle's
 * schema, and the reference sequence display). On those five the reads answered
 * `undefined` while typed `number` / `boolean`, silently, exactly as
 * `getConf` on an undeclared slot always does.
 *
 * Inert today, because all five leave `gateEnabled` false and every read is
 * behind it — the invariant the mixin's own docstrings state. What made it worth
 * closing rather than restating is what happens when that stops being true: a
 * gated display with no `fetchSizeLimit` resolves an `undefined` byte budget,
 * and an undefined budget is a gate that never fires. A safety gate that
 * silently does not gate is the quietest failure this subsystem has.
 */
export const regionTooLargeConfigSchemaFields = {
  /**
   * #slot
   */
  // Conservative 1MB floor for the base display; the byte gate prefers an
  // adapter-declared fetchSizeLimit over this (resolveByteLimit), so it only
  // bites adapters that declare none. LinearBasicDisplay raises it to 5MB for
  // feature tracks.
  fetchSizeLimit: {
    type: 'number',
    defaultValue: 1_000_000,
    description:
      "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
    advanced: true,
  },
  /**
   * #slot
   */
  // The prose is in `description` rather than in the JSDoc above it, and that
  // is the difference a spread table makes: the config-doc generator renders a
  // spread slot's `description` and never its JSDoc (same as
  // `treeSidebarConfigSchemaFields`), so prose written up there reaches
  // neither the docs page nor the config editor.
  forceLoad: {
    type: 'boolean',
    defaultValue: false,
    description:
      'Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.',
    advanced: true,
  },
} as const

/**
 * What `RegionTooLargeMixin` asks a composing display's `configuration` to be.
 * Exactly the two slots above and nothing else — it used to be the whole of
 * `BaseLinearDisplayConfigModel`, which both overstated what the mixin needs and
 * admitted every other base slot name to its `getConf` calls.
 */
export type RegionTooLargeConfigModel = ConfigModelForFields<
  typeof regionTooLargeConfigSchemaFields
>
