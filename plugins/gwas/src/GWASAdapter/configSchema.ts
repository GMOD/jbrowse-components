import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { bedTabixConfigSchema } from '@jbrowse/plugin-bed'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Default -log10 p-value column, shared with the add-track UIs so the schema
// default and the form pre-fill can't drift apart.
export const DEFAULT_SCORE_COLUMN = 'neg_log_pvalue'

// Default transform: the column is already -log10, so no remapping. Shared with
// the schema default and the add-track UIs so they can't drift.
export const DEFAULT_SCORE_TRANSFORM = 'none'

// Native (fast-path) score-transform presets offered by the add-track UIs. The
// `scoreTransform` slot also accepts an arbitrary `jexl:...` expression, so this
// is the preset list, not the exhaustive domain.
export const SCORE_TRANSFORMS = ['none', 'negLog10', 'negLog10FromLn'] as const
export type ScoreTransform = (typeof SCORE_TRANSFORMS)[number]

// The `scoreColumn`/`scoreTransform` adapter fields, omitting each when it's at
// its schema default so accepting the defaults writes no config noise (the
// already-`-log10` genome-wide case emits neither). Shared by both add-track
// entry points so the omit-at-default rule can't drift.
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
    },
    /**
     * #slot
     * optional PLINK .ld sub-adapter (PlinkLDAdapter / PlinkLDTabixAdapter)
     * supplying pairwise r² used for LocusZoom-style coloring when the Manhattan
     * display's `colorBy` is `ld`; null disables it
     */
    ldAdapter: {
      type: 'frozen',
      defaultValue: null,
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
