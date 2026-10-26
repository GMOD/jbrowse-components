import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FeatureMark
 * #category display
 * The canvas feature displays' `mark`, the box each feature draws as: its
 * `height`, as the alignments display's `pileup.mark.height` is each read's.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', mark: { height: 6 } }
 * ```
 */
export const featureMarkConfigSchema = ConfigurationSchema(
  'FeatureMark',
  {
    /**
     * #slot
     * The main body's height in px under `displayMode: 'normal'`; compact
     * draws it at 0.6 of this and superCompact at 0.3, on the main thread, so
     * a preset never refetches.
     */
    height: {
      type: 'number',
      defaultValue: 10,
      description: 'height of each feature body in pixels',
    },
  },
  { closed: true, plot: true },
)
