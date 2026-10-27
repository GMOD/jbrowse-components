import { aggregateFieldName } from '@jbrowse/core/util/aggregateFieldName'
import { expressionKind } from '@jbrowse/core/util/jexlDiagnostics'
import {
  POSITION_FIELDS,
  stepWrites,
  stepsOutput,
} from '@jbrowse/core/util/stepOutputs'
import { facetForField } from '@jbrowse/display-kit/FacetWritesMixin'
import { rowColorForOtherRows } from '@jbrowse/display-kit/rowColorConfigSchema'
import { rowsForField } from '@jbrowse/display-kit/rowsConfigSchema'

import { AUTO_BIN } from './autoBin.ts'
import {
  AGGREGATE_OPS,
  DEFAULT_AGGREGATE_OP,
  DEFAULT_CELLS_FIELD,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FORMULA_AS,
  DEFAULT_PILEUP_AS,
  DEFAULT_WINDOW_FRAME,
  isWindowFrame,
} from './markVocabulary.ts'
import { MARK_Y_PATHS } from './markYPaths.ts'

import type { DraftMark } from './markEdit.ts'
import type { MarkPlot } from './markPlot.ts'
import type { StepSnapshot } from './markProblems.ts'
import type { AggregateOpName, LineInterpolation } from './markVocabulary.ts'
import type { PlotFields } from './scanPlotFields.ts'
import type { FieldKind } from '@jbrowse/core/util/stepOutputs'
import type { YMember, YScalePaths } from '@jbrowse/wiggle-core'

type Snapshot = Record<string, unknown>

const isRecord = (v: unknown): v is Snapshot =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Comma-separated text as a list, blanks dropped; nothing written is unset. */
export function listOfText(text: string): string[] | undefined {
  const items = text
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

/** A list as the comma-separated text a control holds. */
export function textOfList(list: unknown): string {
  return Array.isArray(list) ? list.join(', ') : ''
}

// A `facet` or `rows` as written: the string shorthand, or the object.
function channelObject(setting: unknown): Snapshot | undefined {
  return typeof setting === 'string'
    ? { field: setting }
    : isRecord(setting)
      ? setting
      : undefined
}

/** The field a plot's `facet` or `rows` splits by, empty where it names none. */
export function splitField(plot: MarkPlot, key: 'facet' | 'rows'): string {
  const field = channelObject(plot[key])?.field
  return typeof field === 'string' ? field : ''
}

/** The order a plot's `facet` or `rows` lists its values in, as text. */
export function splitOrder(plot: MarkPlot, key: 'facet' | 'rows'): string {
  return textOfList(channelObject(plot[key])?.sort)
}

/**
 * The plot with its `facet` or `rows` splitting by `field`: an empty field
 * clears the setting, as `null` does in the JSON box. `base` is the plot as
 * it stood when the edit began, and the field is judged against it, since
 * every keystroke writes: retyping the base's field keeps its order, hidden
 * sections, arrangement and row colors, and another field drops what names
 * the old field's values, as a menu pick does (`facetForField`,
 * `rowsForField`, `rowColorForOtherRows`), keeping the steps.
 */
export function withSplitField(
  plot: MarkPlot,
  key: 'facet' | 'rows',
  field: string,
  base: MarkPlot = plot,
): MarkPlot {
  if (field === '') {
    return { ...plot, [key]: null }
  }
  const held = channelObject(base[key]) ?? channelObject(plot[key]) ?? {}
  if (key === 'facet') {
    return { ...plot, facet: facetForField(held, field) }
  }
  const rows = rowsForField(held, field)
  const baseColor = channelObject(base.rowColor)
  const rowColor =
    baseColor && rows !== held ? rowColorForOtherRows(baseColor) : baseColor
  return { ...plot, rows, ...(rowColor ? { rowColor } : {}) }
}

/**
 * The plot with its `facet` or `rows` listing `text`'s values first. A rows
 * order typed by hand drops the tree, which the order no longer follows.
 */
export function withSplitOrder(
  plot: MarkPlot,
  key: 'facet' | 'rows',
  text: string,
): MarkPlot {
  const held = channelObject(plot[key]) ?? {}
  const { sort: _sort, ...rest } = key === 'rows' ? withoutTree(held) : held
  const sort = listOfText(text)
  return { ...plot, [key]: sort ? { ...rest, sort } : rest }
}

function withoutTree({ tree: _tree, treeProvenance: _p, ...rest }: Snapshot) {
  return rest
}

/** The axis members the form edits, at the mark display's y paths. */
export const AXIS_MEMBERS = [
  'title',
  'type',
  'domainMin',
  'domainMax',
  'grid',
] as const satisfies readonly YMember[]
export type AxisMember = (typeof AXIS_MEMBERS)[number]

const Y_PATHS: YScalePaths = MARK_Y_PATHS

function valueAt(plot: Snapshot, path: readonly string[]) {
  return path.reduce<unknown>(
    (node, key) => (isRecord(node) ? node[key] : undefined),
    plot,
  )
}

// `node` with `value` at `path`, the objects on the way copied; `undefined`
// drops the member
function withValueAt(
  node: Snapshot,
  [head = '', ...rest]: readonly string[],
  value: unknown,
): Snapshot {
  const { [head]: held, ...others } = node
  const next = rest.length
    ? withValueAt(isRecord(held) ? held : {}, rest, value)
    : value
  return next === undefined ? others : { ...others, [head]: next }
}

/** One axis member as a control holds it: text, never a number. */
export function axisMember(plot: MarkPlot, member: AxisMember): string {
  const held = valueAt(plot, Y_PATHS.members[member])
  return held === undefined || held === false || held === null
    ? ''
    : String(held)
}

/**
 * The plot with one axis member written; an empty value clears it, so a
 * cleared end autoscales again.
 */
export function withAxisMember(
  plot: MarkPlot,
  member: AxisMember,
  value: string,
): MarkPlot {
  const written =
    value === ''
      ? undefined
      : member === 'grid'
        ? value === 'true'
        : member === 'domainMin' || member === 'domainMax'
          ? Number(value)
          : value
  return withValueAt(plot, Y_PATHS.members[member], written)
}

/** A step to add, named as the list offers it. */
export interface StepPreset {
  label: string
  steps: StepSnapshot[]
  /** The path a line drawing what the steps answer takes. */
  lineInterpolate?: LineInterpolation
}

/**
 * The steps the form adds, each the common first form of its kind. A bin
 * alone counts nothing, so the count per bin is the pair a density is.
 */
export const STEP_PRESETS: readonly StepPreset[] = [
  {
    label: 'Keep features where...',
    steps: [{ type: 'filter', expr: 'jexl:' }],
  },
  {
    label: 'Compute a field',
    steps: [{ type: 'formula', expr: 'jexl:', as: DEFAULT_FORMULA_AS }],
  },
  {
    label: 'Count per bin',
    steps: [
      { type: 'bin', step: AUTO_BIN },
      { type: 'aggregate', ops: [{ op: 'count' }] },
    ],
  },
  { label: 'Coverage', steps: [{ type: 'coverage' }] },
  { label: 'Pack into rows', steps: [{ type: 'pileup' }] },
  { label: 'One per subfeature', steps: [{ type: 'flatten' }] },
  { label: 'Other end of a pair', steps: [{ type: 'mate' }] },
  {
    label: 'Moving average',
    steps: [{ type: 'window', ops: [{ op: 'mean', field: 'score' }] }],
    lineInterpolate: 'linear',
  },
]

export function stepsOfMark(mark: DraftMark): StepSnapshot[] {
  return Array.isArray(mark.transform) ? mark.transform.filter(isRecord) : []
}

export function withSteps(mark: DraftMark, steps: StepSnapshot[]): DraftMark {
  if (steps.length > 0) {
    return { ...mark, transform: steps }
  }
  const { transform: _dropped, ...rest } = mark
  return rest
}

/** One step's slot written, an empty value clearing it to its default. */
export function withStepSlot(
  step: StepSnapshot,
  slot: string,
  value: string,
): StepSnapshot {
  const written =
    value === ''
      ? undefined
      : slot === 'step'
        ? value === AUTO_BIN
          ? AUTO_BIN
          : Number(value)
        : slot === 'padding'
          ? Number(value)
          : value
  const next: Snapshot = { ...step, [slot]: written }
  return Object.fromEntries(
    Object.entries(next).filter(([, v]) => v !== undefined),
  ) as StepSnapshot
}

/**
 * An aggregate or window with its one op, or the first of several, written, keeping the
 * name its output was written under, which a channel may read.
 */
export function withAggregateOp(
  step: StepSnapshot,
  op: AggregateOpName,
  field: string,
): StepSnapshot {
  if (step.type !== 'aggregate' && step.type !== 'window') {
    return step
  }
  const [first, ...rest] = step.ops ?? []
  return {
    ...step,
    ops: [
      {
        op,
        ...(op === 'count' || !field ? {} : { field }),
        ...(first?.as ? { as: first.as } : {}),
      },
      ...rest,
    ],
  }
}

/** A window's frame as the step reads it: the one written, else the default. */
export function windowFrameOf(
  step: StepSnapshot,
): [number | null, number | null] {
  const frame = step.type === 'window' ? step.frame : undefined
  return isWindowFrame(frame) ? frame : [...DEFAULT_WINDOW_FRAME]
}

/**
 * A window with the rows on one side of its frame written: a count, either
 * side spelled positive, or nothing for every row to the group's end.
 */
export function withWindowFrame(
  step: StepSnapshot,
  side: 'before' | 'after',
  text: string,
): StepSnapshot {
  if (step.type !== 'window') {
    return step
  }
  const rows = text.trim() === '' ? null : Math.abs(Number(text))
  if (Number.isNaN(rows)) {
    return step
  }
  const [before, after] = windowFrameOf(step)
  return {
    ...step,
    frame:
      side === 'before'
        ? [rows === null ? null : -rows, after]
        : [before, rows],
  }
}

export { AGGREGATE_OPS }

/** A step as the list names it, with what it writes. */
export function stepSummary(step: StepSnapshot): string {
  switch (step.type) {
    case 'filter': {
      return `keep ${step.expr || '…'}`
    }
    case 'formula': {
      return `${step.as || DEFAULT_FORMULA_AS} = ${step.expr || '…'}`
    }
    case 'bin': {
      return `bin ${step.step ?? 10000}${step.fields?.length === 2 ? `, cutting ${step.fields.join('-')}` : ''}`
    }
    case 'aggregate': {
      const names = (step.ops ?? []).map(op =>
        aggregateFieldName({ ...op, op: op.op ?? DEFAULT_AGGREGATE_OP }),
      )
      return `aggregate ${names.join(', ') || 'count'}`
    }
    case 'window': {
      const names = (step.ops ?? []).map(op =>
        aggregateFieldName({ ...op, op: op.op ?? DEFAULT_AGGREGATE_OP }),
      )
      const [before, after] = windowFrameOf(step)
      return `window ${names.join(', ') || 'count'} over rows ${before ?? '-∞'} to ${after ?? '∞'}`
    }
    case 'coverage': {
      return `coverage as ${step.as || DEFAULT_COVERAGE_AS}`
    }
    case 'pileup': {
      return `pileup into ${step.as || DEFAULT_PILEUP_AS}`
    }
    case 'flatten': {
      return `one per ${step.field || 'subfeature'}`
    }
    case 'cells': {
      return `cells of ${step.field || DEFAULT_CELLS_FIELD}`
    }
    case 'mate': {
      return 'other end of each pair'
    }
  }
}

const POSITIONS = new Set<string>(POSITION_FIELDS)

/**
 * The fields a channel can name after `steps`: the scanned features' own,
 * less those a step that made its rows anew dropped, and the ones the steps
 * write, each under the kind of value it holds. A step's write outranks the
 * scan, so a cell's text `state` is categorical whatever a feature field of
 * that name held.
 */
export function stepFields(
  scanned: PlotFields,
  steps: readonly StepSnapshot[],
): PlotFields {
  const { written, surviving } = stepsOutput(steps)
  const survives = (field: string) => !surviving || surviving.has(field)
  const computed = formulaKinds(steps)
  const kindOf = new Map(
    written
      .map(w => ({ ...w, kind: computed.get(w.field) ?? w.kind }))
      .filter(w => w.kind !== 'unknown' && !POSITIONS.has(w.field))
      .map(w => [w.field, w.kind]),
  )
  const offered = (list: readonly string[], kind: FieldKind) => [
    ...new Set([
      ...list.filter(f => survives(f) && (kindOf.get(f) ?? kind) === kind),
      ...[...kindOf].filter(([, k]) => k === kind).map(([f]) => f),
    ]),
  ]
  const sparse = scanned.sparse?.filter(survives)
  return {
    ...scanned,
    numeric: offered(scanned.numeric, 'numeric'),
    categorical: offered(scanned.categorical, 'categorical'),
    ...(sparse ? { sparse } : {}),
  }
}

// What each field a formula wrote last holds, where its expression makes that
// plain; a later step's write of the field takes over, as in stepsOutput.
function formulaKinds(steps: readonly StepSnapshot[]) {
  const kinds = new Map<string, FieldKind>()
  for (const step of steps) {
    for (const { field, kind } of stepWrites(step)) {
      if (step.type === 'formula') {
        const inferred = step.expr ? expressionKind(step.expr) : 'unknown'
        if (inferred === 'unknown') {
          kinds.delete(field)
        } else {
          kinds.set(field, inferred)
        }
      } else if (kind !== 'unknown') {
        kinds.delete(field)
      }
    }
  }
  return kinds
}

/** The zoom a density takes over at, in bp per px. */
export const DENSITY_TAKES_OVER_BP_PER_PX = 100

/**
 * The marks with a zoomed-out count added: one bar per zoom-following bin,
 * drawn from `DENSITY_TAKES_OVER_BP_PER_PX` out, and every mark naming no zoom
 * range of its own drawn only closer in, so the two never draw together.
 */
export function withDensityMark(marks: readonly DraftMark[]): DraftMark[] {
  return [
    ...marks.map(mark =>
      mark.minBpPerPx || mark.maxBpPerPx
        ? mark
        : { ...mark, maxBpPerPx: DENSITY_TAKES_OVER_BP_PER_PX },
    ),
    {
      mark: 'bar',
      transform: [
        { type: 'bin', step: AUTO_BIN },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
      minBpPerPx: DENSITY_TAKES_OVER_BP_PER_PX,
    },
  ]
}

/** The marks with one copied in right after itself. */
export function duplicateMark(
  marks: readonly DraftMark[],
  at: number,
): DraftMark[] {
  const mark = marks[at]
  return mark ? marks.toSpliced(at + 1, 0, structuredClone(mark)) : [...marks]
}
