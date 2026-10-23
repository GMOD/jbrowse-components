import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { yChannelSchema } from '@jbrowse/wiggle-core'

/**
 * #config CoverageEncoding
 * #category display
 * The coverage band's `encoding`: `y`, its depth axis, a
 * [YChannel](../ychannel). `scale.constant` starts at 1, which makes symlog
 * exactly `log(depth+1)` with the knee at one read. `scale.fenceQuantile`
 * stays at 1, the deepest base in view; the Coverage axis panel's Clip
 * extreme outliers writes 0.99, which stops the axis at twice the 99th
 * percentile of the covered bins' peaks.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   coverage: { encoding: { y: { scale: { type: 'log' } } } },
 * }
 * ```
 */
export const coverageEncodingConfigSchema = ConfigurationSchema(
  'CoverageEncoding',
  {
    /**
     * #slot y
     */
    y: yChannelSchema({ constant: 1 }),
  },
  { closed: true },
)
