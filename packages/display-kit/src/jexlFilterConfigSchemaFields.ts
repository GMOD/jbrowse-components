/**
 * The `jexlFilters` slot, spread into a schema the way
 * `densityTierConfigSchemaFields` is. Three schemas take it — the canvas base
 * display (and so `LinearVariantDisplay`), the mark display, and the shared
 * multi-sample variant schema — because those are the displays whose models
 * read it, through `configuredJexlFilters`. It sat on
 * `baseLinearDisplayConfigSchema` until the six other displays inheriting it
 * there turned out to read nothing, so a `jexlFilters` in an alignments,
 * synteny, MAF, multi-row-feature or LD track config validated, loaded and
 * filtered nothing.
 */
export const jexlFilterConfigSchemaFields = {
  /**
   * #slot
   * config jexlFilters are deferred evaluated so they are prepended with
   * jexl at runtime rather than being stored with jexl in the config
   */
  jexlFilters: {
    type: 'stringArray',
    description:
      'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
    // Empty on purpose: the slot seeds the "Filter by..." dialog, so a default
    // is an expression every user meets before writing one of their own. The
    // NCBI source-record rule that used to live here is `hideSourceFeatures` on
    // the canvas display's own schema.
    defaultValue: [],
  },
} as const
