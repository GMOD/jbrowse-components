import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config CoverageInterbase
 * #category display
 * The coverage band's `interbase` layer: the insertion and clip count bars
 * and their indicator triangles, drawn between the bases they sit between.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', coverage: { interbase: { show: false } } }
 * ```
 */
export const coverageInterbaseConfigSchema = ConfigurationSchema(
  'CoverageInterbase',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the insertion and clip count bars and their indicator triangles',
    },
  },
  { closed: true },
)
