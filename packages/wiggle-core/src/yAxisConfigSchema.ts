import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config YAxis
 * #category display
 * A [YChannel](../ychannel)'s `axis`, the guide it draws: whether it draws
 * at all, its `title` and `grid`.
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
     * Draw the axis, Vega-Lite's `axis: null` when off: its ticks and
     * labels, the `[min, max]` caption a short band takes instead, its title
     * and its grid. The scale's `rules` still draw.
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw the axis, its caption and grid; the rules still draw',
    },
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
