import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const DEFAULT_CHORD_OPACITY = 0.32

/**
 * #config ChordOpacity
 * #category display
 * A variant chord display's `encoding.opacity`: one alpha for every resting
 * chord, over its color's own. A number is written to `value`.
 *
 * #example
 * ```js
 * { type: 'ChordVariantDisplay', encoding: { opacity: 0.45 } }
 * ```
 */
export const chordOpacityConfigSchema = ConfigurationSchema(
  'ChordOpacity',
  {
    /**
     * #slot value
     */
    value: {
      type: 'maybeNumber',
      description: `the alpha every resting chord draws at, 0 to 1, over its color's own; unset is ${DEFAULT_CHORD_OPACITY}`,
    },
  },
  { shorthand: 'value', writes: 'whole', closed: true },
)
