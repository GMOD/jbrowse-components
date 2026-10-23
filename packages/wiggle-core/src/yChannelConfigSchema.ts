import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { valueScaleRuleSchema } from './valueScaleConfigSchema.ts'
import { yAxisSchema } from './yAxisConfigSchema.ts'
import { yScaleSchema } from './yScaleConfigSchema.ts'

import type { YScaleOptions } from './yScaleConfigSchema.ts'

/**
 * #config YChannel
 * #category display
 * A value axis written as Vega-Lite's `encoding.y`: its `scale`, the `axis`
 * guide it draws, and `rules`, reference lines at chosen values across every
 * band the scale rules. A rule naming no `color` draws in the one color the
 * chrome rules every plot in.
 *
 * #example
 * A log depth axis floored at 1, with a labelled line at 30x:
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   coverage: {
 *     encoding: {
 *       y: {
 *         scale: { type: 'log', domainMin: 1 },
 *         rules: [{ value: 30, label: '30x' }],
 *       },
 *     },
 *   },
 * }
 * ```
 *
 * #example
 * Three samples' coverage on one axis that still follows the data:
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   coverage: { encoding: { y: { scale: { group: 'depth' } } } },
 * }
 * ```
 */
export function yChannelSchema(options: YScaleOptions = {}) {
  return ConfigurationSchema(
    'YChannel',
    {
      /**
       * #slot scale
       * `type`, `domainMin`, `domainMax`, `zero`, `fenceQuantile`, `constant`
       * and `group`.
       */
      scale: yScaleSchema(options),
      /**
       * #slot axis
       * `title` and `grid`.
       */
      axis: yAxisSchema,
      /**
       * #slot
       * Horizontal reference lines, each `{ value, color, label }` or a bare
       * number. An autoscaled end widens to keep every rule on the axis; a
       * pinned end that excludes one drops it.
       */
      rules: types.array(valueScaleRuleSchema()),
    },
    { closed: true },
  )
}

export type YChannelConfigSchema = ReturnType<typeof yChannelSchema>
