import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config PileupMark
 * #category display
 * The pileup's `mark`, the bar each read draws as: its `height`.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', pileup: { mark: { height: 3 } } }
 * ```
 */
export const pileupMarkConfigSchema = ConfigurationSchema(
  'PileupMark',
  {
    /**
     * #slot
     * The one compactness setting: the spacing between reads follows from it,
     * and the Normal, Compact and Super-compact
     * presets (7, 3, 1) and the fit-mode squeeze all write or read it.
     */
    height: {
      type: 'number',
      defaultValue: 7,
      description: 'height of each read in pixels',
    },
  },
  { closed: true },
)
