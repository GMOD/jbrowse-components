import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { VALUE_SCALE_TYPES } from './valueScaleConfigSchema.ts'

export interface YScaleOptions {
  /** `scale.fenceQuantile`'s default: 1 follows the extremes, 0.99 fences a spike */
  fenceQuantile?: number
  /** `scale.constant`'s default */
  constant?: number
}

/**
 * #config YScale
 * #category display
 * A [YChannel](../ychannel)'s `scale`: its type, its pinned ends, the outlier
 * fence an unpinned end follows, and the group it autoscales with. An end
 * left unset autoscales over the loaded regions.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   coverage: { encoding: { y: { scale: { type: 'symlog', domainMax: 100 } } } },
 * }
 * ```
 */
export function yScaleSchema({
  fenceQuantile = 1,
  constant = 0,
}: YScaleOptions) {
  return ConfigurationSchema(
    'YScale',
    {
      /**
       * #slot
       * The axis's scale type, which sets the ticks, the cross-hatches and
       * the renderer's placement. `log` cannot represent 0 or negative values
       * and floors the domain above them; `symlog` is log-like away from zero
       * and linear through it.
       */
      type: {
        type: 'stringEnum',
        model: types.enumeration('YScaleType', [...VALUE_SCALE_TYPES]),
        defaultValue: 'linear',
        description: VALUE_SCALE_TYPES.join(' or '),
      },
      /**
       * #slot
       * The bottom of the axis. Unset autoscales that end to the loaded
       * regions. The axis panel's Min field writes here.
       */
      domainMin: {
        type: 'maybeNumber',
        description: 'pinned bottom of the axis; unset autoscales',
      },
      /**
       * #slot
       * The top of the axis. Unset autoscales that end.
       */
      domainMax: {
        type: 'maybeNumber',
        description: 'pinned top of the axis; unset autoscales',
      },
      /**
       * #slot
       * Whether an autoscaled linear or symlog axis reaches 0 whatever the
       * loaded values span, Vega-Lite's `zero`. A pinned end is unmoved either
       * way, and a log axis has no 0. The axis panel's "Include 0" toggles it.
       */
      zero: {
        type: 'boolean',
        defaultValue: true,
        description:
          'an autoscaled linear or symlog axis reaches 0; off, it spans the loaded values',
      },
      /**
       * #slot
       * The fence for an unpinned end's outliers. Below `1`, an extreme that
       * would stretch the axis past twice the span this quantile of the
       * values draws stops at that fence, and the bars past it show the red
       * clip strip. Each end's quantile is measured among the values on its
       * side of 0. A color ramp's `domainQuantile` clips at the quantile
       * itself instead. The axis panel's "Clip extreme outliers" toggles it.
       */
      fenceQuantile: {
        type: 'number',
        defaultValue: fenceQuantile,
        description:
          'fences outliers: 1 follows the extremes; below it an extreme past twice the span this quantile draws is cut there',
      },
      /**
       * #slot
       * Width of symlog's linear region around zero. `0` derives it from the
       * domain, a thousandth of its largest magnitude; `1` makes symlog
       * exactly `log(value+1)`.
       */
      constant: {
        type: 'number',
        defaultValue: constant,
        description: "width of symlog's linear region around zero",
        advanced: true,
      },
      /**
       * #slot
       * A name shared by the tracks whose axes autoscale together: each
       * unpinned end spans the data of every track in the view naming the
       * same group. A pinned end stays this track's own. The axis panel's
       * "Share axis with" writes it.
       */
      group: {
        type: 'maybeString',
        description: 'tracks naming one group autoscale together',
      },
    },
    { closed: true, scaleFence: 'fenceQuantile' },
  )
}
