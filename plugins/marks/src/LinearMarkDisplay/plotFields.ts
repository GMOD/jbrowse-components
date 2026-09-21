import { deepEqual } from '@jbrowse/core/util/deepEqual'
import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'

import type { Feature } from '@jbrowse/core/util'
import type { ColorScaleName } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * The value scale `bin`/`aggregate` hands over to, in bp per px: the raw mark
 * draws below it and the binned count at or above it.
 */
export const BINNED_BP_PER_PX = 100

export const PLOT_FIELD_SAMPLE = 200

// Structure rather than data: a plot of `start` or of `uniqueId` says nothing,
// and `subfeatures` is a tree.
const NON_PLOT_FIELDS = new Set([
  'uniqueId',
  'refName',
  'start',
  'end',
  'subfeatures',
  'parentId',
  'type',
  'name',
  'id',
  'description',
])

// A code, not a quantity: +1 and -1 want a palette and never a ramp.
const ALWAYS_CATEGORICAL = new Set(['strand'])

/** The plottable fields the scanned features carry, split by what they hold. */
export interface PlotFields {
  numeric: string[]
  categorical: string[]
  /** The `source` field where the features carry more than one, a row each. */
  facet?: string
}

const FACET_FIELD = 'source'

function isNumericValue(v: unknown) {
  return typeof v === 'number'
    ? Number.isFinite(v)
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
}

/**
 * The fields a sample of features carry, each numeric only where every value
 * seen for it read as a finite number. Enumerated through `toJSON`, not
 * `tags()`: `tags` is `SimpleFeature`'s, and the `Feature` interface an adapter
 * may implement carries only the serializer.
 */
export function scanPlotFields(features: Feature[]): PlotFields {
  const numeric = new Map<string, boolean>()
  const sources = new Set<unknown>()
  const n = Math.min(features.length, PLOT_FIELD_SAMPLE)
  for (let i = 0; i < n; i++) {
    for (const [field, value] of Object.entries(features[i]!.toJSON())) {
      if (field === FACET_FIELD) {
        sources.add(value)
      }
      if (
        NON_PLOT_FIELDS.has(field) ||
        value === undefined ||
        value === null ||
        value === ''
      ) {
        continue
      }
      const num = !ALWAYS_CATEGORICAL.has(field) && isNumericValue(value)
      numeric.set(field, (numeric.get(field) ?? true) && num)
    }
  }
  const fields = [...numeric.keys()].sort()
  return {
    numeric: fields.filter(f => numeric.get(f)!),
    categorical: fields.filter(f => !numeric.get(f)!),
    ...(sources.size > 1 ? { facet: FACET_FIELD } : {}),
  }
}

export const MARK_SHAPE_CHOICES = ['bar', 'point'] as const
export type PlotShape = (typeof MARK_SHAPE_CHOICES)[number]

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
  shape: PlotShape
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
  shape: 'bar',
  colorField: '',
  binned: false,
}

/** One `marks` entry as a config snapshot holds it, defaults left off. */
export interface MarkSnapshot {
  shape?: string
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
    shape: spec.shape,
    encoding: { y: spec.field, ...(color === undefined ? {} : { color }) },
    ...(spec.binned ? { maxBpPerPx: BINNED_BP_PER_PX } : {}),
  }
  return spec.binned
    ? [
        plot,
        {
          shape: 'bar',
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
 * declared: bars of `score` where the features carry a numeric one. Nothing
 * where they do not — there is no second column every format agrees on, and
 * guessing one would draw a picture the user did not ask for.
 */
export function defaultPlotMarks(fields: PlotFields) {
  return fields.numeric.includes(DEFAULT_PLOT_FIELD)
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

function isPlotShape(shape: string): shape is PlotShape {
  return (MARK_SHAPE_CHOICES as readonly string[]).includes(shape)
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
  const shape = plot?.shape ?? 'bar'
  if (!plot || !isPlotShape(shape)) {
    return undefined
  }
  const color = plot.encoding?.color
  const colorField = paintedField(color)
  const spec: PlotSpec = {
    field: plot.encoding?.y ?? '',
    shape,
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
