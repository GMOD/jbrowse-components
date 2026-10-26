import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_CLIP_QUANTILE } from '@jbrowse/core/util/quantileExtent'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { yFieldChannelSchema } from '@jbrowse/wiggle-core'

import { wiggleColorSchema } from './wiggleColorConfigSchema.ts'
import { wiggleSizeSchema } from './wiggleSizeConfigSchema.ts'

/**
 * #config WiggleEncoding
 * #category display
 * The quantitative display's `encoding`, the channels its marks paint
 * through.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', encoding: { color: { value: 'darkgreen' } } }
 * ```
 *
 * #example
 * The bins' maxima on a log axis, with a labelled line at 30:
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   encoding: {
 *     y: {
 *       field: 'maxScore',
 *       scale: { type: 'log' },
 *       rules: [{ value: 30, label: '2 copies' }],
 *     },
 *   },
 * }
 * ```
 */
export const wiggleEncodingConfigSchema = ConfigurationSchema(
  'WiggleEncoding',
  {
    /**
     * #slot color
     * One CSS color in `value`, or the score through a `scale`, with a key.
     */
    color: wiggleColorSchema,
    /**
     * #slot y
     * The value axis, a [YFieldChannel](../yfieldchannel): `field`, the
     * summary or column each mark plots, and the `scale`, `axis` and `rules`
     * it is drawn through. `scale.fenceQuantile` starts at 0.99, fencing a
     * spike. The density rendering draws no rule and does not widen to one:
     * it spends color on the score and has no axis to rule.
     */
    y: yFieldChannelSchema({ fenceQuantile: DEFAULT_CLIP_QUANTILE }),
    /**
     * #slot size
     * A point's diameter in px. The track menu's Scatter point size writes
     * it.
     */
    size: wiggleSizeSchema,
    /**
     * #slot strokeWidth
     * A line's width in px, Vega-Lite's stroke width. The track menu's Line
     * width writes it.
     */
    strokeWidth: wiggleSizeSchema,
  },
  encodingOptions,
)
