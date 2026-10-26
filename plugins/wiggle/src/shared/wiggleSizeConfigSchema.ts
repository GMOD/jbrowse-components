import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config WiggleSize
 * #category display
 * A quantitative mark's width in px, as `color` is its color: a point's
 * `size`, its diameter, or a line's `strokeWidth`, its thickness. A number
 * is the constant every point or line takes, and is written to `value`.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', mark: 'point', encoding: { size: 4 } }
 * ```
 * ```js
 * { type: 'LinearWiggleDisplay', mark: 'line', encoding: { strokeWidth: 2 } }
 * ```
 */
export const wiggleSizeSchema = ConfigurationSchema(
  'WiggleSize',
  {
    /**
     * #slot value
     * The px every point or line takes. Unset is the mark's own, 2 for a
     * point and 1 for a line. Writing `size: 4` lands here.
     */
    value: {
      type: 'maybeNumber',
      description: "px for every point or line; unset is the mark's own",
    },
  },
  { shorthand: 'value', writes: 'whole', closed: true },
)
