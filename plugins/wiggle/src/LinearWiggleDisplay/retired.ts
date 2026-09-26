import {
  RETIRED_ROW_STATE_KEYS,
  liftRetiredRowState,
} from '@jbrowse/display-kit/retiredSettings'

import {
  WIGGLE_NEG_COLOR_DEFAULT,
  WIGGLE_POS_COLOR_DEFAULT,
} from '../colorDefaults.ts'

import type {
  DisplayEntry,
  RetiredDisplayState,
  RetiredDisplayType,
} from '@jbrowse/core/pluggableElementTypes'

const isRecord = (v: unknown): v is DisplayEntry =>
  !!v && typeof v === 'object' && !Array.isArray(v)

// v4.3.0's multi-wiggle renderings, each a plot and a layout at once, and the
// `multixyplot` jb2hubs writes for a UCSC overlay multiWig.
const MULTI_RENDERINGS: Record<string, readonly [string, string]> = {
  multirowxy: ['xyplot', 'source'],
  multirowdensity: ['density', 'source'],
  multirowline: ['line', 'source'],
  multiline: ['line', ''],
  xyplot: ['xyplot', ''],
  multixyplot: ['xyplot', ''],
}

/**
 * A `MultiLinearWiggleDisplay` entry's rendering as the plot it drew and
 * whether its sources took a row each.
 *
 * A `rows.field` the entry spells wins, so a folded entry folds to itself: a
 * session track's entry keeps the retired type and meets the fold again.
 */
export function foldMultiWiggleRendering(entry: DisplayEntry): DisplayEntry {
  const rendering = entry.defaultRendering
  const hit =
    typeof rendering === 'string' ? MULTI_RENDERINGS[rendering] : undefined
  if (!hit) {
    return entry
  }
  const [plot, field] = hit
  const { rows } = entry
  return {
    ...entry,
    defaultRendering: plot,
    rows: isRecord(rows)
      ? { field, ...rows }
      : typeof rows === 'string'
        ? rows
        : field,
  }
}

export const retiredTypes: RetiredDisplayType[] = [
  {
    type: 'MultiLinearWiggleDisplay',
    migrate: foldMultiWiggleRendering,
    values: { defaultRendering: Object.keys(MULTI_RENDERINGS) },
  },
]

const AUTOSCALES = new Set(['local', 'localsd', 'localpercentile'])

function scaleOf({ scale, autoscale, constraints }: DisplayEntry) {
  const y = {
    ...(typeof scale === 'string' ? { type: scale } : {}),
    ...(typeof autoscale === 'string' && AUTOSCALES.has(autoscale)
      ? { autoscale }
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

function colorOf({ color, posColor, negColor }: DisplayEntry) {
  return typeof color === 'string'
    ? { color }
    : typeof posColor === 'string' || typeof negColor === 'string'
      ? {
          color: {
            field: 'score',
            scale: 'threshold',
            domain: [],
            range: [
              typeof negColor === 'string'
                ? negColor
                : WIGGLE_NEG_COLOR_DEFAULT,
              typeof posColor === 'string'
                ? posColor
                : WIGGLE_POS_COLOR_DEFAULT,
            ],
          },
        }
      : {}
}

const SAME_NAME = ['summaryScoreMode', 'displayCrossHatches', 'resolution']

// What a v4 menu wrote on the display instance, and a beta's arrangement.
// `rendererTypeNameState` is the plot a reader picked, which on a multi
// display the retired type's fold splits into a plot and a layout.
export const retiredState: RetiredDisplayState = {
  keys: [
    'rendererTypeNameState',
    'scale',
    'autoscale',
    'constraints',
    'color',
    'posColor',
    'negColor',
    ...SAME_NAME,
    ...RETIRED_ROW_STATE_KEYS,
  ],
  lift: instance => ({
    ...(typeof instance.rendererTypeNameState === 'string'
      ? { defaultRendering: instance.rendererTypeNameState }
      : {}),
    ...scaleOf(instance),
    ...colorOf(instance),
    ...Object.fromEntries(
      SAME_NAME.filter(k => instance[k] !== undefined).map(k => [
        k,
        instance[k],
      ]),
    ),
    ...liftRetiredRowState(instance),
  }),
}
