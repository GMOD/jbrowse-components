import { coverageBandConfigSchema } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LGVSyntenyCoverage
 * #category display
 * The LGVSyntenyDisplay's `coverage` setting: the
 * [CoverageBand](../coverageband) object with `show` defaulting to off.
 *
 * #example
 * ```js
 * { type: 'LGVSyntenyDisplay', coverage: { show: true } }
 * ```
 */
export const lgvSyntenyCoverageConfigSchema = ConfigurationSchema(
  'LGVSyntenyCoverage',
  {
    /**
     * #slot show
     */
    show: {
      type: 'boolean',
      defaultValue: false,
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: coverageBandConfigSchema,
    closed: true,
  },
)
