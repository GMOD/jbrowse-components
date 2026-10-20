import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * #config ChordMark
 * #category display
 * A chord display's `mark`: how far each chord or ribbon curves in toward the
 * center. A chord's curve scales with its length, so two ends at one locus
 * draw a point at the rim.
 *
 * #example
 * ```js
 * { type: 'ChordVariantDisplay', displayId: 'sv-chords', mark: { depth: 0.5 } }
 * ```
 */
export const chordMarkConfigSchema = ConfigurationSchema(
  'ChordMark',
  {
    /**
     * #slot
     */
    depth: {
      type: 'number',
      defaultValue: 0.9,
      description:
        'how deeply each chord curves toward the center, from 0 to 1: 1 runs a chord between opposite points straight through the center, and 0 bows every chord out toward the rim. A shorter chord curves less, in proportion to its length',
    },
  },
  { plot: true, closed: true },
)

/** The config `BaseChordDisplay` reads off the display that composes it. */
export type ChordConfigModel = ConfigModelForFields<{
  mark: typeof chordMarkConfigSchema
}>
