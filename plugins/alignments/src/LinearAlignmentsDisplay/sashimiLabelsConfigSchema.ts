import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SashimiLabels
 * #category display
 * The sashimi band's `labels` layer: each junction's supporting-read count,
 * drawn at its arc's apex.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', sashimi: { labels: { show: true } } }
 * ```
 */
export const sashimiLabelsConfigSchema = ConfigurationSchema(
  'SashimiLabels',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: 'draw the supporting-read count on each arc',
    },
  },
  { closed: true },
)
