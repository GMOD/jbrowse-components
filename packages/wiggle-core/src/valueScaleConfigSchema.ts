import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

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
  /** the display draws `rules` and widens its domain to them */
  rules?: boolean
  /** the display captions its axis with `title` */
  title?: boolean
}

function valueScaleRuleSchema() {
  return ConfigurationSchema(
    'ValueScaleRule',
    {
      /**
       * #slot scales.y.rules.value
       * Where the rule sits on the axis, in the units the axis plots: a
       * `-log10(p)` over a Manhattan plot, a depth over coverage.
       */
      value: {
        type: 'number',
        defaultValue: 0,
        description: 'the value the rule is drawn at',
      },
      /**
       * #slot scales.y.rules.color
       * The line's colour, and its label's. Unset draws every rule in the one
       * colour the chrome rules plots in, so a threshold that means something
       * particular — genome-wide significance, a diploid depth — is one an
       * author paints, on the plot where it means it.
       */
      color: {
        type: 'maybeColor',
        description: 'line and label colour; unset is the chrome’s own',
      },
      /**
       * #slot scales.y.rules.label
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
    { shorthand: 'value', closed: true },
  )
}

export type ValueScaleRuleConfig = Instance<
  ReturnType<typeof valueScaleRuleSchema>
>

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
 * at `0` on the wiggle family and the mark display and at `1` on the coverage
 * band.
 *
 * The wiggle family, the Manhattan plot and the mark display also carry
 * `rules`, reference lines at chosen values; the mark display adds `title`,
 * the caption beside the axis. A rule naming no `color` draws in the one
 * colour the chrome rules every plot in, so a red line is a claim its author
 * makes rather than a meaning a display assigns.
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
 *   type: 'LinearWiggleDisplay',
 *   scales: { y: { autoscale: 'local' } },
 * }
 * ```
 *
 * #example
 * Three samples' coverage on one axis that still follows the data, each
 * track's display naming the same group:
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   scales: { y: { autoscaleGroup: 'depth' } },
 * }
 * ```
 *
 * #example
 * A titled axis with a labelled genome-wide threshold over a plain
 * suggestive one:
 * ```js
 * {
 *   type: 'LinearMarkDisplay',
 *   scales: {
 *     y: {
 *       title: '-log10 p',
 *       rules: [{ value: 7.3, color: 'red', label: 'p = 5e-8' }, 5],
 *     },
 *   },
 * }
 * ```
 */
export function valueScaleSchema({
  types: scaleTypes,
  autoscale,
  symlogConstant = 0,
  rules,
  title = false,
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
      /**
       * #slot scales.y.autoscaleGroup
       * A name shared by the tracks whose axes autoscale together: each
       * unpinned end spans the data of every track in the view naming the
       * same group, so three coverage lanes stay comparable as the view
       * moves. A pinned end stays this track's own. The score menu's
       * "Autoscale with other tracks" writes it.
       */
      autoscaleGroup: {
        type: 'maybeString',
        description: 'tracks naming one group autoscale together',
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
      ...(title
        ? {
            /**
             * #slot scales.y.title
             * The caption beside the axis, naming what it measures, drawn
             * once however many bands the scale rules and at every zoom.
             * Optional, as JBrowse's other captions are: unset, `""` or
             * `null`, the axis has none; some text is that text.
             */
            title: {
              type: 'maybeString',
              description: 'axis caption; unset draws none',
            },
          }
        : {}),
      ...(rules
        ? {
            /**
             * #slot scales.y.rules
             * Horizontal reference lines at chosen values, across every band
             * the scale rules: a significance threshold, a zero line, an
             * allele-frequency cut. Each is `{ value, color, label }`, or a
             * bare number for a plain line. An autoscaled end widens to keep
             * every rule on the axis; a pinned `domainMin` or `domainMax`
             * that excludes a rule drops it.
             */
            rules: types.array(valueScaleRuleSchema()),
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
