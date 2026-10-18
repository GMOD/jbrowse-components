import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ensureJexlPrefix } from '@jbrowse/core/util/jexlStrings'

/**
 * #config FeatureFilter
 * #category display
 * The tests a feature display applies to the records it fetched, its `filter`
 * slot. A display adding tests of its own extends this schema. A list is
 * shorthand for `{ expressions: [...] }`, and a settings bag names the members
 * one by one.
 *
 * Only a display whose model reads it declares it: the canvas base display
 * (and so `LinearVariantDisplay`) and the mark display take it as it is,
 * `LinearBasicDisplay` and the multi-sample variant display extend it. It sat
 * on `baseLinearDisplayConfigSchema` until the six other displays inheriting
 * it there turned out to read nothing, so a filter in an alignments, synteny,
 * MAF, multi-row-feature or LD track config validated, loaded and filtered
 * nothing.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', filter: ["jexl:feature.score > 100"] }
 * ```
 */
export const featureFilterConfigSchema = ConfigurationSchema(
  'FeatureFilter',
  {
    /**
     * #slot
     * The features the display admits: a feature is drawn when every
     * expression holds. Each entry is a `jexl:` expression over `feature`. The
     * "Filter by..." dialog and "Edit plot..." edit this list, and "Clear all
     * filters" returns it to what the track's config declares.
     */
    expressions: {
      type: 'expressionArray',
      description: 'jexl: expressions a feature must pass to be drawn',
      // Empty on purpose: the slot seeds the "Filter by..." dialog, so a
      // default is an expression every user meets before writing one.
      defaultValue: [],
    },
  },
  { shorthand: 'expressions', writes: 'members', closed: true, plot: true },
)

/**
 * v4's `jexlFilters`, which stored its expressions unprefixed, as `retired`
 * declares it on the base display schema.
 */
export const retiredFilterSpelling = {
  jexlFilters: (list: unknown) => ({
    filter: {
      expressions: Array.isArray(list) ? list.map(ensureJexlPrefix) : list,
    },
  }),
}
