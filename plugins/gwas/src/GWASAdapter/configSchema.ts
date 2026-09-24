import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { bedTabixConfigSchema } from '@jbrowse/plugin-bed'

import type { Instance } from '@jbrowse/mobx-state-tree'

export const DEFAULT_SCORE_COLUMN = 'neg_log_pvalue'

export const DEFAULT_SCORE_TRANSFORM = 'none'

// the presets; the slot also takes a `jexl:` expression
export const SCORE_TRANSFORMS = ['none', 'negLog10', 'negLog10FromLn'] as const
export type ScoreTransform = (typeof SCORE_TRANSFORMS)[number]

export function scoreAdapterFields({
  scoreColumn,
  scoreTransform,
}: {
  scoreColumn: string
  scoreTransform: string
}) {
  return {
    ...(scoreColumn === DEFAULT_SCORE_COLUMN ? {} : { scoreColumn }),
    ...(scoreTransform === DEFAULT_SCORE_TRANSFORM ? {} : { scoreTransform }),
  }
}

/**
 * #config GWASAdapter
 * #trackType GWASTrack
 * #fileFormat gwas | GWAS results (bgzipped, tabix-indexed BED-like)
 * #category adapter
 * adapter for GWAS results files; a BedTabixAdapter with `scoreColumn`
 * defaulted to `neg_log_pvalue` so files load with a sensible Manhattan
 * plot score out of the box
 *
 * #example
 * ```js
 * {
 *   type: 'GWASAdapter',
 *   uri: 'https://example.com/summary_stats.txt.gz',
 * }
 * ```
 *
 * #example
 * Reading a raw p-value column instead, transformed to -log10(p) at load:
 * ```js
 * {
 *   type: 'GWASAdapter',
 *   uri: 'https://example.com/summary_stats.txt.gz',
 *   scoreColumn: 'pval',
 *   scoreTransform: 'negLog10',
 * }
 * ```
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
      defaultValue: DEFAULT_SCORE_COLUMN,
    },
    /**
     * #slot
     * transform applied to `scoreColumn` to produce the Manhattan -log10(p)
     * value: `none` (column is already -log10, e.g. Pan-UKBB neglog10_pval_*),
     * `negLog10` (column is a raw p-value), `negLog10FromLn` (column is a
     * natural-log p-value, e.g. Pan-UKBB Hail `ln P`), or a `jexl:...`
     * expression of `score` for anything else (e.g. `jexl:-log10(score)`) —
     * arbitrary but slower than the native modes, so opt-in only
     */
    scoreTransform: {
      type: 'string',
      description: 'transform applied to the score column',
      defaultValue: DEFAULT_SCORE_TRANSFORM,
      contextVariable: ['score'],
    },
    /**
     * #slot
     * optional PLINK .ld sub-adapter (PlinkLDAdapter / PlinkLDTabixAdapter)
     * supplying pairwise r² used for LocusZoom-style coloring when the Manhattan
     * display's `color.field` is `ld`; leave it unset to disable
     */
    ldAdapter: {
      type: 'maybeFrozen',
      description: 'sub-adapter config for PLINK .ld pairwise r² data',
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
