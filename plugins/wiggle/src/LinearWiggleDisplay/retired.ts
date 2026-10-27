import {
  RETIRED_ROW_STATE_KEYS,
  liftRetiredRowState,
} from '@jbrowse/display-kit/retiredSettings'
import { valueScaleOf } from '@jbrowse/wiggle-core'

import {
  WIGGLE_NEG_COLOR_DEFAULT,
  WIGGLE_POS_COLOR_DEFAULT,
} from '../colorDefaults.ts'
import { WIGGLE_Y_PATHS } from '../shared/wiggleYPaths.ts'

import type {
  DisplayEntry,
  RetiredDisplayState,
  RetiredDisplayType,
} from '@jbrowse/core/pluggableElementTypes'

const isRecord = (v: unknown): v is DisplayEntry =>
  !!v && typeof v === 'object' && !Array.isArray(v)

// Lifts that may each write `encoding`, merged member by member, the first
// winning where two write the same one
function merged(...lifts: DisplayEntry[]): DisplayEntry {
  const out: DisplayEntry = {}
  for (const lift of lifts) {
    for (const [key, value] of Object.entries(lift)) {
      const held = out[key]
      out[key] =
        held === undefined
          ? value
          : isRecord(held) && isRecord(value)
            ? merged(held, value)
            : held
    }
  }
  return out
}

// v4.3.0's multi-wiggle renderings, each a plot and a layout at once
const MULTI_RENDERINGS: Record<string, readonly [string, string]> = {
  multirowxy: ['xyplot', 'source'],
  multirowdensity: ['density', 'source'],
  multirowline: ['line', 'source'],
  multiline: ['line', ''],
  xyplot: ['xyplot', ''],
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

const SAME_NAME = ['displayCrossHatches']

// v4's two colors are the pair about the origin, which bars draw solid either
// side of it and a density plot fades to from white, as v4's renderers did.
function colorOf({ color, posColor, negColor }: DisplayEntry) {
  return typeof color === 'string'
    ? { encoding: { color: { value: color } } }
    : typeof posColor === 'string' || typeof negColor === 'string'
      ? {
          encoding: {
            color: {
              scale: {
                range: [
                  typeof negColor === 'string'
                    ? negColor
                    : WIGGLE_NEG_COLOR_DEFAULT,
                  typeof posColor === 'string'
                    ? posColor
                    : WIGGLE_POS_COLOR_DEFAULT,
                ],
              },
            },
          },
        }
      : {}
}

// v4's `summaryScoreMode`, which named the mean `avg`, the bin's extremes
// `min` and `max`, and drew `whiskers` as the mean inside its min and max
function summaryOf(mode: unknown): DisplayEntry {
  const field = (y: string) => ({ encoding: { y: { field: y } } })
  return typeof mode !== 'string'
    ? {}
    : mode === 'whiskers'
      ? { ...field('score'), extent: 'min-max' }
      : {
          ...field(
            mode === 'min' ? 'minScore' : mode === 'max' ? 'maxScore' : 'score',
          ),
          extent: 'none',
        }
}

// The renderers a v4 config's `renderers` block could configure
const V4_RENDERERS = ['XYPlotRenderer', 'LinePlotRenderer', 'DensityRenderer']

/**
 * v4's `renderers` block, as the display's `retired` reads it: its colors
 * become `encoding.color` and its `summaryScoreMode` `encoding.y.field` and
 * `extent`, and everything else in it is let go. The scale slots beside it are
 * `retiredScaleSpellings`. A display-level `color`, `posColor` and `negColor`
 * get no lift: v4 read them only from a renderer block and from session
 * state, which both lift the pair together, and ignored them on a display
 * entry.
 */
export const retiredConfigSpellings = {
  renderers: (renderers: unknown) => {
    const block = isRecord(renderers) ? renderers : {}
    const named = V4_RENDERERS.map(name => block[name]).filter(isRecord)
    const density = block.DensityRenderer
    return merged(
      named
        .map(r => summaryOf(r.summaryScoreMode))
        .find(a => 'encoding' in a) ?? {},
      named
        .map(r =>
          // a DensityRenderer's one color is what its cells faded to
          r === density && typeof r.color === 'string'
            ? colorOf({ posColor: r.color, negColor: r.color })
            : colorOf(r),
        )
        .find(lifted => 'encoding' in lifted) ?? {},
    )
  },
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
    'resolution',
    ...SAME_NAME,
    ...RETIRED_ROW_STATE_KEYS,
  ],
  lift: instance =>
    merged(
      typeof instance.rendererTypeNameState === 'string'
        ? { defaultRendering: instance.rendererTypeNameState }
        : {},
      valueScaleOf(WIGGLE_Y_PATHS.members)(instance),
      colorOf(instance),
      summaryOf(instance.summaryScoreMode),
      instance.resolution === undefined
        ? {}
        : { data: { resolution: instance.resolution } },
      Object.fromEntries(
        SAME_NAME.filter(k => instance[k] !== undefined).map(k => [
          k,
          instance[k],
        ]),
      ),
      liftRetiredRowState(instance),
    ),
}
