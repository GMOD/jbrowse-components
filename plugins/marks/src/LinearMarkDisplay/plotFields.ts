import { deepEqual } from '@jbrowse/core/util/deepEqual'
import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'

import type { PlotFields } from './scanPlotFields.ts'
import type { ColorScaleName } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * The value scale `bin`/`aggregate` hands over to, in bp per px: the raw mark
 * draws below it and the binned count at or above it.
 */
export const BINNED_BP_PER_PX = 100

export const MARK_TYPE_CHOICES = ['bar', 'point'] as const
export type PlotMark = (typeof MARK_TYPE_CHOICES)[number]

/** A mark's `encoding.color` as a config snapshot holds it. */
type ColorSnapshot =
  | string
  | {
      field?: string
      scale?: ColorScaleName
      [member: string]: unknown
    }

/** What the Plot field dialog asks for, and what the marks are built from. */
export interface PlotSpec {
  field: string
  mark: PlotMark
  colorField: string
  binned: boolean
  /**
   * The declared colour as written and the field it paints. A save that leaves
   * the colour field alone writes it back whole, and picking another field
   * starts from none of it.
   */
  declaredColor?: { field: string; color: ColorSnapshot }
}

export const EMPTY_PLOT_SPEC: PlotSpec = {
  field: '',
  mark: 'bar',
  colorField: '',
  binned: false,
}

/** One `marks` entry as a config snapshot holds it, defaults left off. */
export interface MarkSnapshot {
  mark?: string
  encoding?: { y?: string; color?: ColorSnapshot; [channel: string]: unknown }
  transform?: Record<string, unknown>[]
  minBpPerPx?: number
  maxBpPerPx?: number
  [slot: string]: unknown
}

function colorEncoding(
  { colorField, declaredColor }: PlotSpec,
  fields: PlotFields,
): ColorSnapshot | undefined {
  if (declaredColor?.field === colorField) {
    return declaredColor.color
  }
  return colorField === ''
    ? undefined
    : {
        field: colorField,
        scale: fields.numeric.includes(colorField) ? 'linear' : 'categorical',
      }
}

/** The `marks` a spec writes: the plot itself, and a binned count beside it. */
export function plotMarks(spec: PlotSpec, fields: PlotFields): MarkSnapshot[] {
  const color = colorEncoding(spec, fields)
  const plot: MarkSnapshot = {
    mark: spec.mark,
    encoding: { y: spec.field, ...(color === undefined ? {} : { color }) },
    ...(spec.binned ? { maxBpPerPx: BINNED_BP_PER_PX } : {}),
  }
  return spec.binned
    ? [
        plot,
        {
          mark: 'bar',
          transform: [
            { type: 'bin', step: 'auto' },
            {
              type: 'aggregate',
              groupby: ['start', 'end'],
              ops: [{ op: 'count' }],
            },
          ],
          encoding: { y: 'count' },
          minBpPerPx: BINNED_BP_PER_PX,
        },
      ]
    : [plot]
}

export const DEFAULT_PLOT_FIELD = 'score'

/**
 * What a display picked from the Display types menu draws with nothing
 * declared: bars of `score` where most features carry a numeric one. Nothing
 * where they do not — there is no second column every format agrees on, and
 * guessing one would draw a picture the user did not ask for, as a score on
 * one feature in a hundred would.
 */
export function defaultPlotMarks(fields: PlotFields) {
  return fields.numeric.includes(DEFAULT_PLOT_FIELD) &&
    !fields.sparse?.includes(DEFAULT_PLOT_FIELD)
    ? plotMarks({ ...EMPTY_PLOT_SPEC, field: DEFAULT_PLOT_FIELD }, fields)
    : undefined
}

const NO_FIELDS: PlotFields = { numeric: [], categorical: [] }

function paintedField(color: ColorSnapshot | undefined) {
  if (typeof color !== 'object') {
    return ''
  }
  const { field = '', scale } = color
  return paintedScale({ field, scale }, 'categorical') === 'none' ? '' : field
}

function isPlotMark(mark: string): mark is PlotMark {
  return (MARK_TYPE_CHOICES as readonly string[]).includes(mark)
}

/**
 * The spec a declared `marks` reopens the dialog on, or nothing where a save
 * would not be the round trip it looks like: the marks the spec writes back,
 * through `canonical` (the config schema's own snapshot of a list), have to be
 * the marks declared. So a channel, a step, a zoom range or a slot added after
 * this was written counts as more than the dialog can read without being
 * listed here.
 */
export function specOfMarks(
  declared: readonly MarkSnapshot[],
  canonical: (marks: readonly MarkSnapshot[]) => unknown,
): PlotSpec | undefined {
  const [plot, second] = declared
  const mark = plot?.mark ?? 'bar'
  if (!plot || !isPlotMark(mark)) {
    return undefined
  }
  const color = plot.encoding?.color
  const colorField = paintedField(color)
  const spec: PlotSpec = {
    field: plot.encoding?.y ?? '',
    mark,
    colorField,
    binned: second !== undefined,
    ...(color === undefined
      ? {}
      : { declaredColor: { field: colorField, color } }),
  }
  return deepEqual(canonical(plotMarks(spec, NO_FIELDS)), canonical(declared))
    ? spec
    : undefined
}
