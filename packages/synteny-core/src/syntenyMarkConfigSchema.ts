import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * The curves a synteny ribbon's sides take, d3-shape's names: `linear` a
 * straight side, `bump` the S-curve leaving and meeting each row square.
 */
export const RIBBON_INTERPOLATIONS = ['linear', 'bump'] as const
export type RibbonInterpolation = (typeof RIBBON_INTERPOLATIONS)[number]

/**
 * #config SyntenyMark
 * #category view
 * How each synteny ribbon draws between its two rows: the linear synteny
 * view's `mark` and the multi-way display's `ribbons.mark`. Straight sides read a ribbon's slant as the offset between the rows;
 * the bump curve reads a dense whole-genome stack more calmly.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', mark: { interpolate: 'bump' } }
 * ```
 */
export const syntenyMarkConfigSchema = ConfigurationSchema(
  'SyntenyMark',
  {
    /**
     * #slot
     */
    interpolate: {
      type: 'stringEnum',
      model: types.enumeration('RibbonInterpolation', [
        ...RIBBON_INTERPOLATIONS,
      ]),
      defaultValue: 'linear',
      description:
        'the curve of each ribbon side: linear is straight, bump the S-curve that leaves and meets each row square',
    },
  },
  { closed: true },
)
