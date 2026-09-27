import { ensureJexlPrefix } from '@jbrowse/core/util/jexlStrings'

/**
 * The `filter` slot, spread into a schema the way
 * `densityTierConfigSchemaFields` is. Three schemas take it — the canvas base
 * display (and so `LinearVariantDisplay`), the mark display, and the shared
 * multi-sample variant schema — because those are the displays whose models
 * read it, through `configuredJexlFilters`. It sat on
 * `baseLinearDisplayConfigSchema` until the six other displays inheriting it
 * there turned out to read nothing, so a filter in an alignments, synteny,
 * MAF, multi-row-feature or LD track config validated, loaded and filtered
 * nothing.
 */
export const jexlFilterConfigSchemaFields = {
  /**
   * #slot
   * The features the display admits: a feature is drawn when every expression
   * holds. Each entry is a `jexl:` expression over `feature`. The "Filter
   * by..." dialog opens on these and its edits override them for the session.
   */
  filter: {
    type: 'expressionArray',
    description: 'jexl: expressions a feature must pass to be drawn',
    // Empty on purpose: the slot seeds the "Filter by..." dialog, so a default
    // is an expression every user meets before writing one of their own. The
    // NCBI source-record rule that used to live here is `hideSourceFeatures` on
    // the canvas display's own schema.
    defaultValue: [],
  },
} as const

/**
 * v4's `jexlFilters`, which stored its expressions unprefixed, as `retired`
 * declares it on each schema spreading `jexlFilterConfigSchemaFields`.
 */
export const retiredFilterSpelling = {
  jexlFilters: (list: unknown) => ({
    filter: Array.isArray(list) ? list.map(ensureJexlPrefix) : list,
  }),
}
