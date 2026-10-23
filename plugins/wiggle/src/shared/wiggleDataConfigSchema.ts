import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config WiggleData
 * #category display
 * What a quantitative display's fetch reads of a tiered file: `resolution` is
 * the points per pixel it asks for.
 *
 * #example
 * ```json
 * { "type": "LinearWiggleDisplay", "data": { "resolution": 4 } }
 * ```
 */
export const wiggleDataConfigSchema = ConfigurationSchema(
  'WiggleData',
  {
    /**
     * #slot
     */
    resolution: {
      type: 'number',
      defaultValue: 1,
      description:
        'points per pixel the fetch asks a tiered file for: 1 is one per pixel, larger is finer and smaller is coarser. Clamped to the range the Resolution menu offers, so a value outside it reads as the nearest end',
    },
  },
  { closed: true },
)
