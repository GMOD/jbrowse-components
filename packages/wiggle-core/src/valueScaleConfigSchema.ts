import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_CLIP_QUANTILE } from '@jbrowse/core/util/quantileExtent'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

export const VALUE_SCALE_TYPES = ['linear', 'log', 'symlog'] as const

export interface ValueScaleOptions {
  /** `domainQuantile`'s default: 1 follows the extremes, 0.99 fences a spike */
  domainQuantile?: number
  /** `symlogConstant`'s default */
  symlogConstant?: number
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
 * wiggle plot, the alignments coverage band and the mark display, the
 * Manhattan plot among them, each carry one, with the axis guides it draws —
 * its ticks, its `grid`, its `rules` and its `title`.
 *
 * Vega-Lite's spelling: a pinned end is `domainMin` or `domainMax`, an end
 * left unset autoscales over the loaded regions, and `zero` says whether an
 * autoscaled linear or symlog axis reaches 0 whatever those regions hold.
 *
 * Two defaults come from the display rather than from the scale.
 * `domainQuantile` starts at `0.99` on the wiggle plot, fencing a spike, and
 * at `1`, the extremes, on the coverage band and the mark display. `symlogConstant` starts at `0` on the wiggle family and the mark
 * display and at `1` on the coverage band.
 *
 * Every scale carries the same guides: `rules`, reference lines at chosen
 * values, `grid`, a line at every tick, `minimalTicks`, and `title`, the
 * caption beside the axis. A rule naming no `color` draws in the one colour
 * the chrome rules every plot in, so a red line is a claim its author makes
 * rather than a meaning a display assigns.
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
 * A GC line plot whose axis spans the loaded values, 30 to 60%:
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   scales: { y: { zero: false } },
 * }
 * ```
 *
 * #example
 * The whole visible range, spikes included, rather than the fence the wiggle
 * displays start on:
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   scales: { y: { domainQuantile: 1 } },
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
  domainQuantile = 1,
  symlogConstant = 0,
}: ValueScaleOptions = {}) {
  return ConfigurationSchema(
    'ValueScale',
    {
      /**
       * #slot scales.y.type
       * How the axis reads its domain — the ticks, the cross-hatches and the
       * renderer's placement all come from it. `log` cannot represent 0 or
       * negative values and floors the domain above them; `symlog` is log-like
       * away from zero and linear through it, so a track whose values touch or
       * cross 0 keeps them.
       */
      // #region stringEnumSlot
      type: {
        type: 'stringEnum',
        model: types.enumeration('ValueScaleType', [...VALUE_SCALE_TYPES]),
        defaultValue: 'linear',
        description: VALUE_SCALE_TYPES.join(' or '),
      },
      // #endregion
      /**
       * #slot scales.y.domainMin
       * The bottom of the axis, pinning what would otherwise autoscale to the
       * loaded regions. Unset autoscales that end. The Y axis panel's Min
       * field writes here.
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
       * #slot scales.y.zero
       * Whether an autoscaled linear or symlog axis reaches 0 whatever the
       * loaded values span, Vega-Lite's `zero`. On, a plot of values between
       * 30 and 60 draws 0 to 60, and a bar always shows its whole height.
       * Off, the axis spans the values alone. A pinned end is unmoved either
       * way, a log axis has no 0, and a density plot, which maps score to
       * colour and has no axis, spans its values whatever this says.
       * The Y axis panel's "Include 0" toggles it.
       */
      zero: {
        type: 'boolean',
        defaultValue: true,
        description:
          'an autoscaled linear or symlog axis reaches 0; off, it spans the loaded values',
      },
      /**
       * #slot scales.y.autoscaleGroup
       * A name shared by the tracks whose axes autoscale together: each
       * unpinned end spans the data of every track in the view naming the
       * same group, so three coverage lanes stay comparable as the view
       * moves. A pinned end stays this track's own. The Y axis panel's
       * "Share axis with" writes it.
       */
      autoscaleGroup: {
        type: 'maybeString',
        description: 'tracks naming one group autoscale together',
      },
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
      /**
       * #slot scales.y.domainQuantile
       * Where an unpinned end's outliers are fenced. An end follows the
       * loaded values' extreme; below `1`, an extreme that would stretch the
       * axis past twice the span this quantile of the values draws stops at
       * that fence, and the bars past it wear the red clip strip. So `0.99`
       * leaves a plot with no spike whole and keeps one spike from flattening
       * the rest. Each end's quantile is measured among the values on its side
       * of 0, so a sparse minority tail stays visible, and the span includes 0
       * where `zero` reaches it. A colour ramp's `domainQuantile` clips at the
       * quantile itself, since a saturated colour hides nothing its key does
       * not say. The Y axis panel's "Clip extreme outliers" toggles it.
       */
      domainQuantile: {
        type: 'number',
        defaultValue: domainQuantile,
        description:
          'fences outliers: 1 follows the extremes; below it an extreme past twice the span this quantile draws is cut there',
      },
      /**
       * #slot scales.y.grid
       * Rule the plot across at every tick, ggplot2's panel grid and
       * Vega-Lite's `axis.grid`. The Y axis panel's "Grid lines" toggles
       * it.
       */
      grid: {
        type: 'boolean',
        defaultValue: false,
        description: 'rule the plot at the tick positions',
      },
      /**
       * #slot scales.y.minimalTicks
       * Label only the two ends of the axis.
       */
      minimalTicks: {
        type: 'boolean',
        defaultValue: false,
        description: 'label only the ends of the axis',
        advanced: true,
      },
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
    },
    { closed: true },
  )
}

export type ValueScaleConfigSchema = ReturnType<typeof valueScaleSchema>

/**
 * The axis guides v4 spelt on the display, as `retired` declares them on each
 * display whose scale took them over.
 */
export const retiredAxisSpellings = {
  displayCrossHatches: (grid: unknown) => ({ scales: { y: { grid } } }),
  minimalTicks: (minimalTicks: unknown) => ({
    scales: { y: { minimalTicks } },
  }),
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * v4's display-level scale settings as the `scales.y` members they became.
 * `localpercentile` is a clip; `local`, `localsd`, `global` and `globalsd`
 * all follow the extremes closely enough to become one.
 */
export function valueScaleOf({
  scale,
  autoscale,
  constraints,
}: Record<string, unknown>) {
  const y = {
    ...(typeof scale === 'string' ? { type: scale } : {}),
    ...(typeof autoscale === 'string'
      ? {
          domainQuantile:
            autoscale === 'localpercentile' ? DEFAULT_CLIP_QUANTILE : 1,
        }
      : {}),
    ...(isRecord(constraints) && typeof constraints.min === 'number'
      ? { domainMin: constraints.min }
      : {}),
    ...(isRecord(constraints) && typeof constraints.max === 'number'
      ? { domainMax: constraints.max }
      : {}),
  }
  return Object.keys(y).length > 0 ? { scales: { y } } : {}
}

/**
 * The scale slots v4 declared on a display, as `retired` declares them on
 * each display whose `scales.y` took them over. `minScore` and `maxScore`
 * were unset at v4's own sentinels; `numStdDev` and `inverted` have no
 * successor and are let go.
 */
export const retiredScaleSpellings = {
  scaleType: (scale: unknown) => valueScaleOf({ scale }),
  autoscale: (autoscale: unknown) => valueScaleOf({ autoscale }),
  minScore: (min: unknown) =>
    min === Number.MIN_VALUE ? {} : valueScaleOf({ constraints: { min } }),
  maxScore: (max: unknown) =>
    max === Number.MAX_VALUE ? {} : valueScaleOf({ constraints: { max } }),
  numStdDev: () => ({}),
  inverted: () => ({}),
}

/**
 * The `scales` object a display declares, one member per aesthetic the
 * grammar gives a scale. `y` is the only one so far, and every mark, bar or
 * bin the display draws is placed through it.
 */
export function scalesSchema(y: ValueScaleConfigSchema) {
  return ConfigurationSchema('Scales', { y }, { closed: true })
}

export type ScalesConfigSchema = ReturnType<typeof scalesSchema>
