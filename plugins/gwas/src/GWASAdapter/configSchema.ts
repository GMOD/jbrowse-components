import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { bedTabixConfigSchema } from '@jbrowse/plugin-bed'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config GWASAdapter
 * #category adapter
 * adapter for GWAS results files; a BedTabixAdapter with `scoreColumn`
 * defaulted to `neg_log_pvalue` so files load with a sensible Manhattan
 * plot score out of the box
 */
const GWASAdapterConfigSchema = ConfigurationSchema(
  'GWASAdapter',
  {
    /**
     * #slot
     */
    scoreColumn: {
      type: 'string',
      description: 'BED column to read as the Manhattan plot score',
      defaultValue: 'neg_log_pvalue',
    },
    /**
     * #slot
     * transform applied to `scoreColumn` to produce the Manhattan -log10(p)
     * value: `none` (column is already -log10, e.g. Pan-UKBB neglog10_pval_*),
     * `negLog10` (column is a raw p-value), or `negLog10FromLn` (column is a
     * natural-log p-value, e.g. Pan-UKBB Hail `ln P`)
     */
    scoreTransform: {
      type: 'stringEnum',
      model: types.enumeration('GwasScoreTransform', [
        'none',
        'negLog10',
        'negLog10FromLn',
      ]),
      description: 'transform applied to the score column',
      defaultValue: 'none',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: bedTabixConfigSchema,
    explicitlyTyped: true,
  },
)

export type GWASAdapterConfig = Instance<typeof GWASAdapterConfigSchema>

export default GWASAdapterConfigSchema
