import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/** The autoscale modes a display offers, and the one it starts on. */
export interface ValueScaleAutoscale {
  modes: readonly string[]
  default: string
}

export interface ValueScaleOptions {
  /** the scale types this display's renderer places, `linear` first */
  types: readonly string[]
  /** omitted where the display's domain consults no mode */
  autoscale?: ValueScaleAutoscale
  /** `symlogConstant`'s default, where `types` holds `symlog` */
  symlogConstant?: number
}

/**
 * #config ValueScale
 * #category display
 * The value scale of a quantitative display, written as `scales.y`: the
 * wiggle and multi-wiggle plots, the Manhattan plot, the alignments coverage
 * band and the mark display each carry one. Which members it has follows what
 * the display draws: Manhattan places a linear axis and consults no autoscale
 * mode, so it has neither `type` alternatives nor `autoscale`.
 *
 * Vega-Lite's spelling: a pinned end is `domainMin` or `domainMax`, and an end
 * left unset autoscales over the loaded regions.
 *
 * Two defaults come from the display rather than from the scale. `autoscale`
 * starts at `localpercentile` on the wiggle and multi-wiggle plots and at
 * `local` on the coverage band and the mark display. `symlogConstant` starts
 * at `0` on the wiggle family and at `1` on the coverage band.
 *
 * #example
 * A log axis floored at 1:
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   scales: { y: { type: 'log', domainMin: 1 } },
 * }
 * ```
 *
 * #example
 * The whole visible range, rather than the 99th percentile the wiggle
 * displays start on:
 * ```js
 * {
 *   type: 'MultiLinearWiggleDisplay',
 *   scales: { y: { autoscale: 'local' } },
 * }
 * ```
 */
export function valueScaleSchema({
  types: scaleTypes,
  autoscale,
  symlogConstant = 0,
}: ValueScaleOptions) {
  return ConfigurationSchema(
    'ValueScale',
    {
      /**
       * #slot scales.y.type
       * How the axis reads its domain — the ticks, the cross-hatches and the
       * renderer's placement all come from it. `log` cannot represent 0 or
       * negative values and floors the domain above them; `symlog` is log-like
       * away from zero and linear through it, so a track whose values touch or
       * cross 0 keeps them. Which of the three a display offers is which of
       * them its renderer places.
       */
      // #region stringEnumSlot
      type: {
        type: 'stringEnum',
        model: types.enumeration('ValueScaleType', [...scaleTypes]),
        defaultValue: 'linear',
        description: scaleTypes.join(' or '),
      },
      // #endregion
      /**
       * #slot scales.y.domainMin
       * The bottom of the axis, pinning what would otherwise autoscale to the
       * loaded regions. Unset autoscales that end. The score menu's "Set
       * min/max" writes here.
       */
      domainMin: {
        type: 'maybeNumber',
        description: 'pinned bottom of the axis; unset autoscales',
      },
      /**
       * #slot scales.y.domainMax
       * The top of the axis. Unset autoscales that end.
       */
      domainMax: {
        type: 'maybeNumber',
        description: 'pinned top of the axis; unset autoscales',
      },
      ...(scaleTypes.includes('symlog')
        ? {
            /**
             * #slot scales.y.symlogConstant
             * Width of symlog's linear region around zero. `0` derives it from
             * the domain, a thousandth of its largest magnitude — right for a
             * wiggle track, whose units are its own. The coverage band starts
             * at `1` instead, which makes symlog exactly `log(depth+1)` and
             * puts the knee at one read.
             */
            symlogConstant: {
              type: 'number',
              defaultValue: symlogConstant,
              description: "width of symlog's linear region around zero",
              advanced: true,
            },
          }
        : {}),
      ...(autoscale
        ? {
            /**
             * #slot scales.y.autoscale
             * What an unpinned end scales to: `local` takes the extremes of
             * the visible region, `localsd` the mean ± `numStdDev` standard
             * deviations, `localpercentile` the `numQuantile`-th percentile of
             * each sign, which is robust to a peaky distribution.
             */
            autoscale: {
              type: 'stringEnum',
              model: types.enumeration('ValueScaleAutoscale', [
                ...autoscale.modes,
              ]),
              defaultValue: autoscale.default,
              description: autoscale.modes.join(' or '),
            },
          }
        : {}),
      ...(autoscale?.modes.includes('localsd')
        ? {
            /**
             * #slot scales.y.numStdDev
             * Standard deviations either side of the mean the `localsd`
             * autoscale reaches.
             */
            numStdDev: {
              type: 'number',
              defaultValue: 3,
              description: 'standard deviations for the localsd autoscale',
              advanced: true,
            },
          }
        : {}),
      ...(autoscale?.modes.includes('localpercentile')
        ? {
            /**
             * #slot scales.y.numQuantile
             * The percentile `localpercentile` clips outliers at — 0.99 drops
             * the outermost 1% of each sign. The two signs are measured
             * independently and anchored at 0, so a sparse minority tail
             * stays visible and all-positive data pins its bottom at 0.
             */
            numQuantile: {
              type: 'number',
              defaultValue: 0.99,
              description: 'percentile the localpercentile autoscale clips at',
              advanced: true,
            },
          }
        : {}),
    },
    { closed: true },
  )
}

export type ValueScaleConfigSchema = ReturnType<typeof valueScaleSchema>

/**
 * The `scales` object a display declares, one member per aesthetic the
 * grammar gives a scale. `y` is the only one so far, and every mark, bar or
 * bin the display draws is placed through it.
 */
export function scalesSchema(y: ValueScaleConfigSchema) {
  return ConfigurationSchema('Scales', { y }, { closed: true })
}

export type ScalesConfigSchema = ReturnType<typeof scalesSchema>
