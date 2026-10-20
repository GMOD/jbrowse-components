import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config SyntenyCoord
 * #category view
 * The coordinate system of the linear synteny and dotplot views, ggplot2's
 * `coord_fixed`: `ratio: 1` holds every position axis at one bp per pixel,
 * the dotplot's x and y and each row of a synteny stack, so a longer genome
 * draws longer. Unset, each axis zooms on its own.
 *
 * #example
 * ```js
 * { type: 'DotplotView', coord: { ratio: 1 } }
 * ```
 */
export const syntenyCoordConfigSchema = ConfigurationSchema(
  'SyntenyCoord',
  {
    /**
     * #slot
     */
    ratio: {
      type: 'maybeNumber',
      model: types.maybe(types.literal(1)),
      description:
        '1 gives every position axis the same bp per pixel, and the slot accepts no other number; unset lets each zoom on its own',
    },
  },
  { closed: true },
)
