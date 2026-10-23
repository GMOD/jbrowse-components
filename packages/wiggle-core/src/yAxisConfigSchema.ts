import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config YAxis
 * #category display
 * A [YChannel](../ychannel)'s `axis`, the guide it draws: its `title` and
 * `grid`.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   coverage: { encoding: { y: { axis: { title: 'depth', grid: true } } } },
 * }
 * ```
 */
export const yAxisSchema = ConfigurationSchema(
  'YAxis',
  {
    /**
     * #slot
     * The caption beside the axis, drawn once however many bands the scale
     * rules. Unset, `""` or `null` draws none.
     */
    title: {
      type: 'maybeString',
      description: 'axis caption; unset draws none',
    },
    /**
     * #slot
     * Rule the plot across at every tick, Vega-Lite's `axis.grid`. The axis
     * panel's "Grid lines" toggles it.
     */
    grid: {
      type: 'boolean',
      defaultValue: false,
      description: 'rule the plot at the tick positions',
    },
  },
  { closed: true },
)
