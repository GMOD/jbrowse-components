import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FeatureUtrs
 * #category display
 * The gene glyphs' `utrs`, the thinner boxes a coding transcript draws past
 * its CDS, which `encoding.color` paints. Unset, a UTR takes its transcript's
 * fill, a field's color or a constant, and the contrasting UTR blue where
 * nothing sets a fill.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearBasicDisplay',
 *   utrs: { encoding: { color: { value: 'lightblue' } } },
 * }
 * ```
 */
export const featureUtrsConfigSchema = ConfigurationSchema(
  'FeatureUtrs',
  {
    /**
     * #slot encoding
     * The channel the UTR boxes paint through.
     */
    encoding: ConfigurationSchema(
      'FeatureUtrEncoding',
      {
        /**
         * #slot encoding.color
         * A constant only: a UTR takes a field's color through its
         * transcript's fill.
         */
        color: ConfigurationSchema(
          'FeatureUtrColor',
          {
            /**
             * #slot encoding.color.value
             */
            value: {
              type: 'maybeColor',
              description:
                "a CSS color, or a `jexl:` callback over `feature` returning one, painting every UTR box over its transcript's fill",
              contextVariable: ['feature'],
            },
          },
          { closed: true },
        ),
      },
      { closed: true },
    ),
  },
  { closed: true },
)
