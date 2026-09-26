import { aggregateFieldName } from '@jbrowse/core/util/aggregateFieldName'

import { AUTO_BIN } from './autoBin.ts'
import {
  AGGREGATE_OPS,
  DEFAULT_AGGREGATE_OP,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FORMULA_AS,
  DEFAULT_PILEUP_AS,
} from './markVocabulary.ts'

import type { DraftMark } from './markEdit.ts'
import type { MarkPlot } from './markPlot.ts'
import type { StepSnapshot } from './markProblems.ts'
import type { AggregateOpName } from './markVocabulary.ts'

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
  return textOfList(channelObject(plot[key])?.domain)
}

/**
 * The plot with its `facet` or `rows` splitting by `field`, keeping the rest
 * of the object: an empty field clears the setting, as `null` does in the
 * JSON box.
 */
export function withSplitField(
  plot: MarkPlot,
  key: 'facet' | 'rows',
  field: string,
): MarkPlot {
  if (field === '') {
    return { ...plot, [key]: null }
  }
  const held = channelObject(plot[key])
  return { ...plot, [key]: { ...held, field } }
}

export function withSplitOrder(
  plot: MarkPlot,
  key: 'facet' | 'rows',
  text: string,
): MarkPlot {
  const held = channelObject(plot[key])
  const domain = listOfText(text)
  const { domain: _dropped, ...rest } = held ?? {}
  return {
    ...plot,
    [key]: domain ? { ...rest, domain } : { ...rest },
  }
}

/** The axis members the form edits, off `scales.y`. */
export const AXIS_MEMBERS = [
  'title',
  'type',
  'domainMin',
  'domainMax',
  'grid',
] as const
export type AxisMember = (typeof AXIS_MEMBERS)[number]

function scaleY(plot: MarkPlot): Snapshot {
  const scales = isRecord(plot.scales) ? plot.scales : undefined
  return isRecord(scales?.y) ? scales.y : {}
}

/** One `scales.y` member as a control holds it: text, never a number. */
export function axisMember(plot: MarkPlot, member: AxisMember): string {
  const held = scaleY(plot)[member]
  return held === undefined || held === false || held === null
    ? ''
    : String(held)
}

/**
 * The plot with one `scales.y` member written; an empty value clears it, so a
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
  const y = { ...scaleY(plot), [member]: written }
  const scales = isRecord(plot.scales) ? plot.scales : {}
  return {
    ...plot,
    scales: {
      ...scales,
      y: Object.fromEntries(
        Object.entries(y).filter(([, v]) => v !== undefined),
      ),
    },
  }
}

/** A step to add, named as the list offers it. */
export interface StepPreset {
  label: string
  steps: StepSnapshot[]
}

/**
 * The steps the form adds, each the common first form of its kind. A bin
 * alone counts nothing, so the count per bin is the pair a density is.
 */
export const STEP_PRESETS: readonly StepPreset[] = [
  { label: 'Keep features where…', steps: [{ type: 'filter', expr: 'jexl:' }] },
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

/** An aggregate with its one op, or the first of several, written. */
export function withAggregateOp(
  step: StepSnapshot,
  op: AggregateOpName,
  field: string,
): StepSnapshot {
  if (step.type !== 'aggregate') {
    return step
  }
  const [, ...rest] = step.ops ?? []
  return {
    ...step,
    ops: [{ op, ...(op === 'count' || !field ? {} : { field }) }, ...rest],
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
      return `bin ${step.step ?? 10000}`
    }
    case 'aggregate': {
      const names = (step.ops ?? []).map(op =>
        aggregateFieldName({ ...op, op: op.op ?? DEFAULT_AGGREGATE_OP }),
      )
      return `aggregate ${names.join(', ') || 'count'}`
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
    case 'mate': {
      return 'other end of each pair'
    }
  }
}

/**
 * The fields a mark's steps write, which the field pickers offer beside the
 * ones the features carry: an aggregate's summaries, a coverage's depth, a
 * formula's output, a pileup's row.
 */
export function stepWrittenFields(steps: readonly StepSnapshot[]): string[] {
  return steps.flatMap(step => {
    switch (step.type) {
      case 'coverage': {
        return [step.as || DEFAULT_COVERAGE_AS]
      }
      case 'aggregate': {
        return (step.ops ?? []).map(op =>
          aggregateFieldName({ ...op, op: op.op ?? DEFAULT_AGGREGATE_OP }),
        )
      }
      case 'formula': {
        return [step.as || DEFAULT_FORMULA_AS]
      }
      case 'pileup': {
        return [step.as || DEFAULT_PILEUP_AS]
      }
      default: {
        return []
      }
    }
  })
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
