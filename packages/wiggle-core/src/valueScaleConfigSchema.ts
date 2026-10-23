import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_CLIP_QUANTILE } from '@jbrowse/core/util/quantileExtent'
import { types } from '@jbrowse/mobx-state-tree'

import { SCALES_Y_PATHS } from './yScalePaths.ts'

import type { YMember, YScalePaths } from './yScalePaths.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export const VALUE_SCALE_TYPES = ['linear', 'log', 'symlog'] as const

export interface ValueScaleOptions {
  /** `domainQuantile`'s default: 1 follows the extremes, 0.99 fences a spike */
  domainQuantile?: number
  /** `symlogConstant`'s default */
  symlogConstant?: number
}

export function valueScaleRuleSchema() {
  return ConfigurationSchema(
    'ValueScaleRule',
    {
      /**
       * #slot scales.y.rules.value
       * The rule's position on the axis, in the units the axis plots: a
       * `-log10(p)` over a Manhattan plot, a depth over coverage.
       */
      value: {
        type: 'number',
        defaultValue: 0,
        description: 'the value the rule is drawn at',
      },
      /**
       * #slot scales.y.rules.color
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
    { shorthand: 'value', writes: 'whole', closed: true },
  )
}

export type ValueScaleRuleConfig = Instance<
  ReturnType<typeof valueScaleRuleSchema>
>

/**
 * #config ValueScale
 * #category display
 * The value scale of a quantitative display, written as `scales.y`: the
 * wiggle plot and the mark display, the Manhattan plot among them, each have
 * one, with the axis guides it draws — its ticks, its `grid`, its `rules` and
 * its `title`. The coverage band of the alignments and MAF displays writes
 * its axis as `coverage.encoding.y`, a [YChannel](../ychannel).
 *
 * Vega-Lite's spelling: a pinned end is `domainMin` or `domainMax`, an end
 * left unset autoscales over the loaded regions, and `zero` sets whether an
 * autoscaled linear or symlog axis reaches 0 whatever those regions hold.
 *
 * `domainQuantile` starts at `0.99` on the wiggle plot, fencing a spike, and
 * at `1`, the extremes, on the mark display.
 *
 * Every scale has the same guides: `rules`, reference lines at chosen
 * values, `grid`, a line at every tick, `minimalTicks`, and `title`, the
 * caption beside the axis. A rule naming no `color` draws in the one color
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
 * Three samples' signal on one axis that still follows the data, each
 * track's display naming the same group:
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
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
       * The axis's scale type, which sets the ticks, the cross-hatches and the
       * renderer's placement. `log` cannot represent 0 or
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
       * color and has no axis, spans its values whatever this says.
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
       * wiggle track, whose units depend on the dataset.
       */
      symlogConstant: {
        type: 'number',
        defaultValue: symlogConstant,
        description: "width of symlog's linear region around zero",
        advanced: true,
      },
      /**
       * #slot scales.y.domainQuantile
       * The fence for an unpinned end's outliers. An end follows the
       * loaded values' extreme; below `1`, an extreme that would stretch the
       * axis past twice the span this quantile of the values draws stops at
       * that fence, and the bars past it show the red clip strip. So `0.99`
       * leaves a plot with no spike whole and keeps one spike from flattening
       * the rest. Each end's quantile is measured among the values on its side
       * of 0, so a sparse minority tail stays visible, and the span includes 0
       * where `zero` reaches it. A color ramp's `domainQuantile` clips at the
       * quantile itself, since the key shows what a saturated color stands
       * for. The Y axis panel's "Clip extreme outliers" toggles it.
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
    { closed: true, scaleFence: 'domainQuantile' },
  )
}

export type ValueScaleConfigSchema = ReturnType<typeof valueScaleSchema>

type YMembers = YScalePaths['members']

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

function nestedAt(entries: (readonly [readonly string[], unknown])[]) {
  const out: Record<string, unknown> = {}
  for (const [path, value] of entries) {
    let node = out
    for (const segment of path.slice(0, -1)) {
      node = (node[segment] ??= {}) as Record<string, unknown>
    }
    node[path.at(-1)!] = value
  }
  return out
}

/**
 * The axis guides v4 spelt on the display, as `retired` declares them on each
 * display whose scale took them over, at that display's member paths. A map
 * with no `minimalTicks` drops it.
 */
export function retiredAxisSpellings(members: YMembers) {
  return {
    displayCrossHatches: (grid: unknown) => nestedAt([[members.grid, grid]]),
    minimalTicks: (minimalTicks: unknown) =>
      nestedAt(
        members.minimalTicks ? [[members.minimalTicks, minimalTicks]] : [],
      ),
  }
}

/**
 * v4's display-level scale settings as the y scale members they became, at
 * the display's member paths. `localpercentile` is a clip; `local`,
 * `localsd`, `global` and `globalsd` all follow the extremes closely enough to
 * become one.
 */
export function valueScaleOf(members: YMembers) {
  return ({ scale, autoscale, constraints }: Record<string, unknown>) =>
    nestedAt([
      ...(typeof scale === 'string' ? [[members.type, scale] as const] : []),
      ...(typeof autoscale === 'string'
        ? [
            [
              members.fence,
              autoscale === 'localpercentile' ? DEFAULT_CLIP_QUANTILE : 1,
            ] as const,
          ]
        : []),
      ...(isRecord(constraints) && typeof constraints.min === 'number'
        ? [[members.domainMin, constraints.min] as const]
        : []),
      ...(isRecord(constraints) && typeof constraints.max === 'number'
        ? [[members.domainMax, constraints.max] as const]
        : []),
    ])
}

/**
 * The scale slots v4 declared on a display, as `retired` declares them on
 * each display whose y scale took them over, at its member paths. `minScore`
 * and `maxScore` were unset at v4's own sentinels; `numStdDev` and `inverted`
 * have no successor and are let go.
 */
export function retiredScaleSpellings(members: YMembers) {
  const lift = valueScaleOf(members)
  return {
    scaleType: (scale: unknown) => lift({ scale }),
    autoscale: (autoscale: unknown) => lift({ autoscale }),
    minScore: (min: unknown) =>
      min === Number.MIN_VALUE ? {} : lift({ constraints: { min } }),
    maxScore: (max: unknown) =>
      max === Number.MAX_VALUE ? {} : lift({ constraints: { max } }),
    numStdDev: () => ({}),
    inverted: () => ({}),
  }
}

/**
 * `scales.y` as the members a display moved off it, at its member paths:
 * `domainQuantile` becomes the `fence` member, `symlogConstant` the
 * `constant` and `autoscaleGroup` the `group`. A member the map has no path
 * for, the coverage band's `minimalTicks`, is let go.
 */
export function retiredScalesSpelling(members: YMembers) {
  return (scales: unknown) => {
    const y = isRecord(scales) ? scales.y : undefined
    return isRecord(y)
      ? nestedAt(
          Object.entries(SCALES_Y_PATHS.members).flatMap(([member, from]) => {
            const to = members[member as YMember]
            const name = from.at(-1)!
            return to && name in y ? [[to, y[name]] as const] : []
          }),
        )
      : {}
  }
}

/**
 * The `scales` object a display declares, one member per aesthetic the
 * grammar gives a scale. `y` is the only one so far, and every mark, bar or
 * bin the display draws is placed through it.
 */
export function scalesSchema(y: ValueScaleConfigSchema) {
  return ConfigurationSchema('Scales', { y }, { closed: true, plot: true })
}

export type ScalesConfigSchema = ReturnType<typeof scalesSchema>
