import {
  RETIRED_ROW_STATE_KEYS,
  liftRetiredRowState,
} from '@jbrowse/display-kit/retiredSettings'
import { valueScaleOf } from '@jbrowse/wiggle-core'

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
// `multixyplot` the hosted jb2hubs configs carry on a UCSC overlay multiWig.
// jb2hubs writes `xyplot` now, so that entry goes once the hosted configs are
// synced from it.
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

// The GC content display drew this display over a GCContentAdapter. Its
// window, step and mode stay on the entry here for the GC plugin's track
// handler, which moves them onto the adapter that computes them.
export const retiredTypes: RetiredDisplayType[] = [
  {
    type: 'MultiLinearWiggleDisplay',
    migrate: foldMultiWiggleRendering,
    values: { defaultRendering: Object.keys(MULTI_RENDERINGS) },
  },
  { type: 'LinearGCContentDisplay' },
  { type: 'LinearGCContentTrackDisplay' },
]

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

const SAME_NAME = ['displayCrossHatches', 'resolution']

// v4's `summaryScoreMode`, which named the mean `avg` and drew `whiskers` as
// the mean inside its min and max
function aggregateOf(mode: unknown) {
  return typeof mode !== 'string'
    ? {}
    : mode === 'whiskers'
      ? { aggregate: 'mean', extent: 'min-max' }
      : { aggregate: mode === 'avg' ? 'mean' : mode, extent: 'none' }
}

// What a v4 menu wrote on the display instance, and a beta's arrangement.
const V4_RENDERERS = ['XYPlotRenderer', 'LinePlotRenderer', 'DensityRenderer']

/**
 * v4's `renderers` block, as the display's `retired` reads it: its colors
 * become `color` and its `summaryScoreMode` `aggregate` and `extent`, and
 * everything else in it is let go. The scale slots beside it are `retiredScaleSpellings`.
 */
export const retiredConfigSpellings = {
  renderers: (renderers: unknown) => {
    const block = isRecord(renderers) ? renderers : {}
    const named = V4_RENDERERS.map(name => block[name]).filter(isRecord)
    return {
      ...named
        .map(r => aggregateOf(r.summaryScoreMode))
        .find(a => 'aggregate' in a),
      ...named.map(colorOf).find(lifted => 'color' in lifted),
    }
  },
  summaryScoreMode: aggregateOf,
}

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
    'summaryScoreMode',
    ...SAME_NAME,
    ...RETIRED_ROW_STATE_KEYS,
  ],
  lift: instance => ({
    ...(typeof instance.rendererTypeNameState === 'string'
      ? { defaultRendering: instance.rendererTypeNameState }
      : {}),
    ...valueScaleOf(instance),
    ...colorOf(instance),
    ...aggregateOf(instance.summaryScoreMode),
    ...Object.fromEntries(
      SAME_NAME.filter(k => instance[k] !== undefined).map(k => [
        k,
        instance[k],
      ]),
    ),
    ...liftRetiredRowState(instance),
  }),
}
