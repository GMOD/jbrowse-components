import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config SyntenyData
 * #category display
 * What a comparative fetch reads of a tiered file (a PIF built with a coarse
 * tier), on the linear synteny, dotplot and circular views and the
 * LGVSynteny and multi-way displays: `resolution` is the stored tier.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', data: { resolution: 'coarse' } }
 * ```
 */
export const syntenyDataConfigSchema = ConfigurationSchema(
  'SyntenyData',
  {
    /**
     * #slot
     */
    resolution: {
      type: 'stringEnum',
      model: types.enumeration('SyntenyResolution', ['auto', 'fine', 'coarse']),
      defaultValue: 'auto',
      description:
        "the stored tier to fetch: 'auto' switches at the adapter's bpPerPx threshold, 'fine' pins the per-row CIGAR tier, 'coarse' the tier whose CIGAR is folded to its large indels",
    },
  },
  { closed: true },
)
