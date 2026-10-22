import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SyntenyNavigation
 * #category view
 * The linear synteny view's `navigation`: how a move on one genome row
 * carries to the others. With `follow` on, the rows follow the `anchor` row
 * through the alignment, each moving to whatever region aligns to its window.
 * #example
 * ```js
 * { type: 'LinearSyntenyView', navigation: { follow: true, anchor: 1 } }
 * ```
 */
export const syntenyNavigationConfigSchema = ConfigurationSchema(
  'SyntenyNavigation',
  {
    /**
     * #slot
     */
    follow: {
      type: 'boolean',
      defaultValue: false,
      description:
        'the other rows follow the anchor row through the alignment; a drag or zoom on a row makes it the anchor',
    },
    /**
     * #slot
     */
    anchor: {
      type: 'number',
      defaultValue: 0,
      description: 'the genome row, counted from the top, the others follow',
    },
    /**
     * #slot
     */
    matchOrientation: {
      type: 'boolean',
      defaultValue: false,
      description:
        "while following, flip a row whose placing alignment runs the other way from the anchor's, so the two pan in the same direction",
    },
  },
  { closed: true },
)
