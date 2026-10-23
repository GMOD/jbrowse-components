import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { yAxisSchema } from './yAxisConfigSchema.ts'
import { yScaleSchema } from './yScaleConfigSchema.ts'

import type { YScaleOptions } from './yScaleConfigSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export function valueScaleRuleSchema() {
  return ConfigurationSchema(
    'ValueScaleRule',
    {
      /**
       * #slot rules.value
       * The rule's position on the axis, in the units the axis plots: a
       * `-log10(p)` over a Manhattan plot, a depth over coverage.
       */
      value: {
        type: 'number',
        defaultValue: 0,
        description: 'the value the rule is drawn at',
      },
      /**
       * #slot rules.color
       * The line's color, and its label's. Unset draws every rule in the one
       * color the chrome rules plots in, so a threshold that means something
       * particular — genome-wide significance, a diploid depth — is one an
       * author paints, on the plot where it means it.
       */
      color: {
        type: 'maybeColor',
        description: 'line and label color; unset is the chrome’s own',
      },
      /**
       * #slot rules.label
       * Free text drawn at the rule's right-hand end. JBrowse assigns it no
       * meaning: "2 copies" over a coverage plot is a claim only the author
       * can make, since no ploidy can be assumed.
       */
      label: {
        type: 'string',
        defaultValue: '',
        description: "text at the rule's right-hand end",
      },
    },
    { shorthand: 'value', writes: 'whole', closed: true },
  )
}

export type ValueScaleRuleConfig = Instance<
  ReturnType<typeof valueScaleRuleSchema>
>

/**
 * #config YChannel
 * #category display
 * A value axis written as Vega-Lite's `encoding.y`: its `scale`, the `axis`
 * guide it draws, and `rules`, reference lines at chosen values across every
 * band the scale rules. A rule naming no `color` draws in the one color the
 * chrome rules every plot in. The wiggle display's also names the `field` it
 * plots ([YFieldChannel](../yfieldchannel)).
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
 * A titled Manhattan axis with a labelled genome-wide threshold over a plain
 * suggestive one:
 * ```js
 * {
 *   type: 'LinearManhattanDisplay',
 *   encoding: {
 *     y: {
 *       axis: { title: '-log10 p' },
 *       rules: [{ value: 7.3, color: 'red', label: 'p = 5e-8' }, 5],
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
