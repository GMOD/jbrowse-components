import { markColorScale } from './configSchema.ts'

import type { MarkColorScale } from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'

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

/**
 * What the declared colour carries beside its field. Kept on the spec and
 * keyed by the field it came from, so reopening the dialog and saving writes
 * the same colour back, and picking another field starts from neither.
 */
export interface PlotColorScale {
  field: string
  scale: MarkColorScale | undefined
  domain: string[]
  palette: string[]
  ramp: string[]
}

/** What the Plot field dialog asks for, and what the marks are built from. */
export interface PlotSpec {
  field: string
  shape: PlotShape
  colorField: string
  binned: boolean
  colorScale?: PlotColorScale
}

export const EMPTY_PLOT_SPEC: PlotSpec = {
  field: '',
  shape: 'bar',
  colorField: '',
  binned: false,
}

interface MarkSnapshot {
  shape: string
  encoding: Record<string, unknown>
  transform?: Record<string, unknown>[]
  minBpPerPx?: number
  maxBpPerPx?: number
}

function colorEncoding(spec: PlotSpec, fields: PlotFields) {
  const { colorField, colorScale } = spec
  if (colorField === '') {
    return undefined
  }
  const kept = colorScale?.field === colorField ? colorScale : undefined
  return {
    field: colorField,
    scale:
      kept?.scale ??
      (fields.numeric.includes(colorField) ? 'linear' : 'categorical'),
    ...(kept?.domain.length ? { domain: kept.domain } : {}),
    ...(kept?.palette.length ? { palette: kept.palette } : {}),
    ...(kept?.ramp.length ? { ramp: kept.ramp } : {}),
  }
}

/** The `marks` a spec writes: the plot itself, and a binned count beside it. */
export function plotMarks(spec: PlotSpec, fields: PlotFields): MarkSnapshot[] {
  const color = colorEncoding(spec, fields)
  const plot: MarkSnapshot = {
    shape: spec.shape,
    encoding: { y: spec.field, ...(color ? { color } : {}) },
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

interface MarkLike {
  shape: string
  encoding: {
    y: string
    color: {
      field: string
      scale: MarkColorScale | undefined
      domain: readonly string[]
      palette: readonly string[]
      ramp: readonly string[]
    }
  }
  transform: { type: string }[]
}

/**
 * The spec a declared `marks` reopens the dialog on, or nothing where the
 * config says more than the dialog can: a span, a third mark, a transform on
 * the plot itself.
 */
export function specOfMarks(marks: readonly MarkLike[]): PlotSpec | undefined {
  const [plot, second, ...rest] = marks
  if (
    !plot ||
    rest.length > 0 ||
    plot.transform.length > 0 ||
    !(MARK_SHAPE_CHOICES as readonly string[]).includes(plot.shape) ||
    (second && !second.transform.some(s => s.type === 'bin'))
  ) {
    return undefined
  }
  const { color } = plot.encoding
  const colorField = markColorScale(color) === 'none' ? '' : color.field
  return {
    field: plot.encoding.y,
    shape: plot.shape as PlotShape,
    colorField,
    binned: second !== undefined,
    ...(colorField
      ? {
          colorScale: {
            field: colorField,
            scale: color.scale,
            domain: [...color.domain],
            palette: [...color.palette],
            ramp: [...color.ramp],
          },
        }
      : {}),
  }
}
