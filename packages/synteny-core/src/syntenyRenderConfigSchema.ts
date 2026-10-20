import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SyntenyRender
 * #category view
 * How the linear synteny and circular views rasterize their ribbons, apart
 * from what the data says: `antialias` gives a ribbon thinner than a pixel
 * the share of the pixel it covers, so an unfiltered whole-genome view reads
 * as the density it has rather than a solid block.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', render: { antialias: false } }
 * ```
 */
export const syntenyRenderConfigSchema = ConfigurationSchema(
  'SyntenyRender',
  {
    /**
     * #slot
     */
    antialias: {
      type: 'maybeBoolean',
      description:
        'fade a sub-pixel ribbon by the share of the pixel it covers, down to 0.15 of its alpha; ribbon edges stay antialiased either way. Unset fades once sub-pixel ribbons dominate a display',
    },
  },
  { closed: true },
)
