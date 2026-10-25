import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { yChannelSchema } from '@jbrowse/wiggle-core'

import { markColorSchema } from './markColorConfigSchema.ts'

/**
 * #config MarkDisplayEncoding
 * #category display
 * The mark display's `encoding`: the channels every mark reads unless it
 * says otherwise, as ggplot2's plot-level aesthetics are each layer's. `y`
 * is the value axis every mark's `encoding.y` is read through; `color` is
 * the color a mark paints whose own `encoding.color` says nothing.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMarkDisplay',
 *   encoding: { y: { scale: { type: 'log' }, axis: { title: 'depth' } } },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearMarkDisplay',
 *   encoding: { color: { scale: { type: 'identity' } } },
 *   marks: [{ mark: 'rect' }],
 * }
 * ```
 */
export const markDisplayEncodingSchema = ConfigurationSchema(
  'MarkDisplayEncoding',
  {
    /**
     * #slot y
     * The value axis every mark's `encoding.y` is read through: `scale`,
     * `axis` and `rules`.
     */
    y: yChannelSchema(),
    /**
     * #slot color
     * The color of every mark whose own `encoding.color` names no value,
     * field or scale, a [MarkColor](../markcolor).
     */
    color: markColorSchema,
  },
  { closed: true, plot: true },
)
