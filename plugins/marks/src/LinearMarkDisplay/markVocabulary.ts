/**
 * The names a `marks` list is written in and the ones a slot left off reads
 * as, in a module that imports only the rule list's seam: the config schema declares its
 * enumerations and defaults from here, the rule list reads the same constants,
 * and `jbrowse validate` carries a copy of both. What a step writes, and
 * the defaults it writes under, are the step table's.
 */

export {
  BIN_OVERLAP_FIELD,
  DEFAULT_AGGREGATE_OP,
  DEFAULT_BIN_AS,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FORMULA_AS,
  DEFAULT_PILEUP_AS,
} from './markRuleFacts.ts'

export const MARK_TYPES = [
  'bar',
  'point',
  'rule',
  'line',
  'rect',
  'text',
  'link',
] as const
export type MarkType = (typeof MARK_TYPES)[number]
export const DEFAULT_MARK_TYPE: MarkType = 'bar'

/**
 * How a line or a link joins its ends. Which of them each type draws, its
 * default first, is `MARK_SPECS`' `interpolations`.
 */
export const MARK_INTERPOLATIONS = ['step', 'linear', 'dome', 'arc'] as const
export type MarkInterpolation = (typeof MARK_INTERPOLATIONS)[number]

/** How a line joins its values: held across each span, or centre to centre. */
export type LineInterpolation = Extract<MarkInterpolation, 'step' | 'linear'>
export const DEFAULT_LINE_INTERPOLATE: LineInterpolation = 'step'

/** The members of a `mark` object one type alone reads, beside its `type`. */
export const MARK_MEMBERS = ['interpolate', 'height', 'gapBp'] as const
export type MarkMember = (typeof MARK_MEMBERS)[number]

/** The fraction of its band a rect fills where its `mark.height.band` is left unwritten. */
export const DEFAULT_HEIGHT_BAND = 1

/** A `marks` entry's `mark` as a snapshot holds it: the object, or its type alone. */
export type MarkDefSnapshot =
  | MarkType
  | {
      type?: MarkType
      interpolate?: MarkInterpolation
      height?: { band?: number }
      gapBp?: number
    }

/** The type a `marks` entry draws, whichever way its `mark` is written. */
export function markTypeOf(entry: { mark?: MarkDefSnapshot }): MarkType {
  const { mark } = entry
  return (typeof mark === 'string' ? mark : mark?.type) ?? DEFAULT_MARK_TYPE
}

/** A `marks` entry's `mark` as an object, `{}` where the type alone is written. */
export function markDefOf(entry: { mark?: MarkDefSnapshot }) {
  const { mark } = entry
  return typeof mark === 'object' ? mark : {}
}
/** The diameter a point draws at where its `size` is left unwritten, and a rule's thickness where its `strokeWidth` is. */
export const DEFAULT_POINT_DIAMETER_PX = 4

/** The width a line strokes at where its `strokeWidth` is left unwritten. */
export const DEFAULT_LINE_WIDTH_PX = 1

/** The stroke a link draws at where its `strokeWidth` is left unwritten. */
export const DEFAULT_LINK_STROKE_PX = 2

/** The cuts a threshold color paints, render-core's `MAX_COLOR_CUTS`. */
export const MAX_THRESHOLD_CUTS = 8

/** The scales a mark's `color` offers; `identity` paints each feature its own color, its field's or its BED color. */
export const MARK_COLOR_SCALES = [
  'ordinal',
  'linear',
  'log',
  'symlog',
  'threshold',
  'identity',
] as const

export const SIZE_SCALES = ['linear', 'log'] as const
export type SizeScaleName = (typeof SIZE_SCALES)[number]

export const DEFAULT_BIN_FIELD = 'start'
export const DEFAULT_FLATTEN_FIELD = 'subfeatures'
export const DEFAULT_CELLS_FIELD = 'seq'
/** The rows before and after each row a `window` reads: a moving average over 21. */
export const DEFAULT_WINDOW_FRAME = [-10, 10] as const

/**
 * Whether a `window`'s `frame` is what the step reads: two whole row offsets,
 * either `null` for unbounded, the first not past the second.
 */
export function isWindowFrame(
  frame: unknown,
): frame is [number | null, number | null] {
  if (!Array.isArray(frame) || frame.length !== 2) {
    return false
  }
  const [before, after] = frame as unknown[]
  const end = (v: unknown) => v === null || Number.isInteger(v)
  return (
    end(before) &&
    end(after) &&
    (before === null || after === null || Number(before) <= Number(after))
  )
}
export const DEFAULT_PILEUP_FIELDS = ['start', 'end'] as const
export const DEFAULT_TEXT_FIELD = 'name'
export const DEFAULT_X2 = 'end'

export { AGGREGATE_OPS } from './markRuleFacts.ts'
export type { AggregateOpName } from './markRuleFacts.ts'
