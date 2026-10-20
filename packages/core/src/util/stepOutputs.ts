/**
 * What each transform step does to the rows it reads, stated once for the
 * runtime's facet split, the validator, the field pickers and the channels a
 * mark adopts by default. Imports nothing, so the validator's copy of the mark
 * rule list carries it unchanged.
 *
 * Every step type answers three things:
 * - `rowwise`: it answers each row from that row alone and in order, so a
 *   facet split may run ahead of it.
 * - `replacesRows`: it makes its rows anew (an aggregate, a coverage), so a
 *   field survives it only where it writes that field or keeps it as a group.
 * - `writes`: the fields it sets, each with the kind of value it holds and the
 *   channel a mark leaving that channel unwritten reads it through.
 */

/** The field an aggregate op writes: `as` where named, else `count` for a count, else `<op>_<field>`. */
export function aggregateFieldName({
  op,
  field,
  as,
}: {
  op: string
  field?: string
  as?: string
}) {
  return as || (op === 'count' || !field ? op : `${op}_${field}`)
}

export const DEFAULT_FORMULA_AS = 'value'
export const DEFAULT_COVERAGE_AS = 'coverage'
export const DEFAULT_PILEUP_AS = 'row'
export const DEFAULT_AGGREGATE_OP = 'count'
/** The summaries an `aggregate` or a `window` op computes. */
export const AGGREGATE_OPS = ['count', 'sum', 'mean', 'min', 'max'] as const
export type AggregateOpName = (typeof AGGREGATE_OPS)[number]
export const DEFAULT_BIN_AS: readonly [string, string] = ['start', 'end']
/** What a `bin` over `fields` writes on each piece: the bases of its interval inside its bin. */
export const BIN_OVERLAP_FIELD = 'overlap'
/** What a `cells` step writes: `state` on every cell, `base` on a mismatch or an insertion, `match` off a gap or a reference `N`, `length` on an insertion. */
export const CELLS_FIELDS = ['state', 'base', 'match', 'length'] as const
/** What a `mate` step writes on every feature it answers. */
export const MATE_FIELDS = [
  'mate.refName',
  'mate.start',
  'mate.end',
  'mate.mateDirection',
  'mateDirection',
  'alt',
  'svType',
] as const
/** Where a row stands, which every row keeps through every step. */
export const POSITION_FIELDS = ['refName', 'start', 'end'] as const

/** The kind of value a step writes into a field; `unknown` keeps whatever the field held. */
export type FieldKind = 'numeric' | 'categorical' | 'unknown'

/** A channel a step's output fills where a mark leaves it unwritten. */
export type FilledChannel = 'y' | 'row' | 'x2'

export interface WrittenField {
  field: string
  kind: FieldKind
  fills?: FilledChannel
}

/** A step as a config node, a snapshot or a worker request holds it, any default unwritten. */
export interface StepOutline {
  type: string
  as?: string | readonly string[]
  ops?: readonly { op?: string; field?: string; as?: string }[]
  groupby?: readonly string[]
  fields?: readonly string[]
  index?: string
  key?: string
}

export interface StepOutput {
  rowwise: boolean
  replacesRows: boolean
  /** `edges` are the fields the last `bin` before this step wrote its edges to. */
  writes: (step: StepOutline, edges: readonly string[]) => WrittenField[]
}

function named(as: StepOutline['as'], fallback: string) {
  return typeof as === 'string' && as !== '' ? as : fallback
}

/** Two non-empty field names: what a `bin`'s `as` and `fields` and a `pileup`'s `fields` read as a pair. */
export function isFieldPair(
  names: readonly string[] | string | undefined,
): names is readonly [string, string] {
  return Array.isArray(names) && names.length === 2 && !!names[0] && !!names[1]
}

function binEdges(step: StepOutline): readonly string[] {
  return isFieldPair(step.as) ? step.as : DEFAULT_BIN_AS
}

// A single op names the `y` its mark reads; two leave the mark to choose.
function summaries(step: StepOutline): WrittenField[] {
  const ops = step.ops ?? []
  return ops.map(({ op = DEFAULT_AGGREGATE_OP, field, as }) => ({
    field: aggregateFieldName({ op, field, as }),
    kind: 'numeric' as const,
    ...(ops.length === 1 ? { fills: 'y' as const } : {}),
  }))
}

const kept = (field: string): WrittenField => ({ field, kind: 'unknown' })

export const STEP_OUTPUTS = {
  filter: { rowwise: true, replacesRows: false, writes: () => [] },
  formula: {
    rowwise: true,
    replacesRows: false,
    writes: step => [
      { field: named(step.as, DEFAULT_FORMULA_AS), kind: 'numeric' },
    ],
  },
  bin: {
    rowwise: true,
    replacesRows: false,
    writes: step => [
      ...binEdges(step).map(field => ({ field, kind: 'numeric' as const })),
      ...(isFieldPair(step.fields)
        ? [{ field: BIN_OVERLAP_FIELD, kind: 'numeric' as const }]
        : []),
    ],
  },
  cells: {
    rowwise: true,
    replacesRows: false,
    writes: () => [
      { field: 'start', kind: 'numeric' },
      { field: 'end', kind: 'numeric' },
      { field: 'state', kind: 'categorical' },
      { field: 'base', kind: 'categorical' },
      { field: 'match', kind: 'numeric' },
      { field: 'length', kind: 'numeric' },
    ],
  },
  aggregate: {
    rowwise: false,
    replacesRows: true,
    writes: (step, edges) => [
      ...(step.groupby?.length ? step.groupby : edges).map(kept),
      ...summaries(step),
    ],
  },
  window: { rowwise: false, replacesRows: false, writes: summaries },
  coverage: {
    rowwise: false,
    replacesRows: true,
    writes: step => [
      {
        field: named(step.as, DEFAULT_COVERAGE_AS),
        kind: 'numeric',
        fills: 'y',
      },
    ],
  },
  pileup: {
    rowwise: false,
    replacesRows: false,
    writes: step => [
      {
        field: named(step.as, DEFAULT_PILEUP_AS),
        kind: 'numeric',
        fills: 'row',
      },
    ],
  },
  flatten: {
    rowwise: false,
    replacesRows: false,
    writes: step => [
      ...(step.index ? [{ field: step.index, kind: 'numeric' as const }] : []),
      ...(step.key ? [{ field: step.key, kind: 'categorical' as const }] : []),
    ],
  },
  mate: {
    rowwise: false,
    replacesRows: false,
    writes: () =>
      MATE_FIELDS.map(field => ({
        field,
        kind:
          field === 'mate.start' || field === 'mate.end'
            ? ('numeric' as const)
            : ('categorical' as const),
        ...(field === 'mate.refName' ? { fills: 'x2' as const } : {}),
      })),
  },
} satisfies Record<string, StepOutput>

export type StepType = keyof typeof STEP_OUTPUTS

function outputOf(step: StepOutline): StepOutput | undefined {
  return Object.hasOwn(STEP_OUTPUTS, step.type)
    ? STEP_OUTPUTS[step.type as StepType]
    : undefined
}

/**
 * The fields one step writes. A step this table does not know writes nothing
 * it can name.
 */
export function stepWrites(
  step: StepOutline,
  edges: readonly string[] = DEFAULT_BIN_AS,
): WrittenField[] {
  return outputOf(step)?.writes(step, edges) ?? []
}

/** Whether a step answers each row from that row alone, in order. */
export function isRowwise(step: StepOutline) {
  return outputOf(step)?.rowwise ?? false
}

/**
 * What a run of steps leaves: every field written, the last write of each
 * winning, and, where a step made the rows anew, the only fields that survive
 * it (`undefined` while the input's own fields all do). `channels` are what
 * the output fills where a mark leaves them unwritten.
 */
export function stepsOutput(steps: readonly (StepOutline | undefined)[]) {
  let edges: readonly string[] = DEFAULT_BIN_AS
  let surviving: Set<string> | undefined
  const written = new Map<string, WrittenField>()
  let channels = new Map<FilledChannel, string>()
  for (const step of steps) {
    const output = step && outputOf(step)
    if (!step || !output) {
      continue
    }
    const writes = output.writes(step, edges)
    if (output.replacesRows) {
      surviving = new Set<string>(POSITION_FIELDS)
      for (const [field] of written) {
        if (!writes.some(w => w.field === field)) {
          written.delete(field)
        }
      }
      for (const w of writes) {
        surviving.add(w.field)
      }
      channels = new Map([...channels].filter(([, f]) => surviving!.has(f)))
    } else {
      for (const w of writes) {
        surviving?.add(w.field)
      }
    }
    for (const w of writes) {
      const held = written.get(w.field)
      written.set(
        w.field,
        w.kind === 'unknown' && held ? { ...held, field: w.field } : w,
      )
      if (w.fills) {
        channels.set(w.fills, w.field)
      }
    }
    if (step.type === 'bin') {
      edges = binEdges(step)
    }
  }
  return { written: [...written.values()], surviving, channels }
}
