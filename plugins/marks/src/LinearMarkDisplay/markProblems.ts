import { AUTO_BIN } from './autoBin.ts'
import {
  aggregateFieldName,
  colorProblems,
  isJexl,
  paintedScale,
} from './markRuleFacts.ts'
import { MARK_SPECS, rampResolvesPerRegion, readsValue } from './markSpecs.ts'
import {
  DEFAULT_AGGREGATE_OP,
  DEFAULT_BIN_AS,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FORMULA_AS,
  DEFAULT_MARK_TYPE,
  DEFAULT_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS,
  MATE_FIELDS,
} from './markVocabulary.ts'

import type { ColorScaleName } from './markRuleFacts.ts'
import type {
  AggregateOpName,
  MarkType,
  MarkSourceName,
} from './markVocabulary.ts'

/**
 * What a config file validator calls a problem. `error`: the mark draws
 * nothing, never draws, or a step cannot run. `warning`: a slot waits unread,
 * or the marks draw in an arrangement the author may not have meant. The
 * display shows both as notices, since a load refuses neither (ADR-133).
 */
export type MarkProblemLevel = 'error' | 'warning'

/**
 * The level of every rule of the list, by the stable id a report and a test
 * refer to it by. A single mark's combination that a JSON schema can state is
 * the mark schema's `requires` and is not restated here.
 */
export const MARK_RULES = {
  /** A channel the mark's type does not read, such as `y` on a `span`. */
  'unread-channel': 'warning',
  /** A `size` on a mark that draws no point. */
  'unread-size': 'warning',
  /** `source: "density"` on a `span` or a `text`, which cannot draw the sidecar's bins. */
  'span-density-source': 'warning',
  /** Threshold cuts that repeat, leaving an interval no value falls in. */
  'threshold-cuts': 'warning',
  /** A threshold `range` not one colour longer than its cuts. */
  'threshold-range': 'warning',
  /** A `domain` on a linear or log colour, whose ends are `domainMin` and `domainMax`. */
  'ramp-domain': 'warning',
  /** A colour ramp's `domainMax` below its `domainMin`. */
  'ramp-ends': 'warning',
  /** A span's or a text's colour ramp with an open end, whose colours then differ from one region to the next. */
  'unpinned-span-ramp': 'warning',
  /** A `minBpPerPx` not below the mark's `maxBpPerPx`, so the mark never draws. */
  'empty-zoom-range': 'error',
  /** A `filter` or `formula` whose `expr` is not a `jexl:` expression. */
  'step-expression': 'error',
  /** A `bin` whose `step` is neither `"auto"` nor a positive width. */
  'bin-width': 'error',
  /** A `bin`'s `as` or a `pileup`'s `fields` naming other than two fields, so the step reads its defaults. */
  'step-pair': 'warning',
  /** A `sum`, `mean`, `min` or `max` naming no `field`. */
  'op-field': 'error',
  /** A step's field written as a `jexl:` expression, where a step reads a name or a dotted path. */
  'step-field-expression': 'error',
  /** A `y` naming a field that no `aggregate` or `coverage` step before it writes. */
  'unwritten-y': 'error',
  /** A bar, point or text drawn beside a mark that stacks rows, standing in the first of them. */
  'value-beside-rows': 'warning',
  /** Two `pileup` steps packing one plot, whose rows share numbers. */
  'two-packings': 'warning',
  /** A `pileup` in the display's `transform` under a `facet`, packing across every section. */
  'cross-section-packing': 'warning',
  /** A second mark standing in for the density sidecar at a zoom where one already does. */
  'second-density-mark': 'warning',
  /** `rows` beside a `facet` on another field, where the facet draws alone. */
  'rows-beside-facet': 'warning',
  /** A `pileup` or a `row` field under `rows`, whose packed rows share their value's one row. */
  'packing-under-rows': 'warning',
} as const satisfies Record<string, MarkProblemLevel>

export type MarkRuleId = keyof typeof MARK_RULES

/**
 * What a `marks` list says that the display cannot draw as written: the rule,
 * the mark, or none for the display's own `transform`, the slot to look at,
 * and why. A problem is a combination of slots,
 * which a load cannot refuse: the config editor writes one slot at a time, so
 * moving a bar to a span passes through a span that still names a `y`, and a
 * refusal there drops the track from the session it was saved in (ADR-133).
 * The display draws what it can and says the rest in its corner notice.
 */
export interface MarkProblem {
  rule: string
  level: MarkProblemLevel
  mark?: number
  slot: string
  message: string
}

type OwnProblem = Omit<MarkProblem, 'mark'>

interface OpSnapshot {
  op?: AggregateOpName
  field?: string
  as?: string
}

/** One `transform` step as a config snapshot holds it, defaults left off. */
export type StepSnapshot =
  | { type: 'filter'; expr?: string }
  | { type: 'formula'; expr?: string; as?: string }
  | { type: 'bin'; step?: number | string; field?: string; as?: string[] }
  | { type: 'aggregate'; groupby?: string[]; ops?: OpSnapshot[] }
  | { type: 'coverage'; as?: string }
  | { type: 'flatten'; field?: string; index?: string; keepEmpty?: boolean }
  | { type: 'pileup'; as?: string; fields?: string[]; padding?: number }
  | { type: 'mate' }

interface ColorSnapshot {
  field?: string
  scale?: ColorScaleName
  domain?: string[]
  domainMin?: number
  domainMax?: number
}

/**
 * The display's `facet` as a config snapshot holds it: the field its sections
 * stack by, a facet naming none grouping nothing, and the steps each section
 * runs before any mark's.
 */
export interface FacetSnapshot {
  field?: unknown
  transform?: StepSnapshot[]
}

/** The display's `rows` as a config snapshot holds it: the field alone. */
export interface RowsSnapshot {
  field?: unknown
}

/**
 * One entry of a `marks` list as a config snapshot holds it, defaults left
 * off. A type alias, which a `Record<string, unknown>` reader takes.
 */
export type MarkSnapshot = {
  mark?: MarkType
  size?: number
  source?: MarkSourceName
  minBpPerPx?: number
  maxBpPerPx?: number
  encoding?: {
    x?: string
    x2?: string
    y?: string
    row?: string
    color?: ColorSnapshot
    shape?: unknown
    text?: string
  }
  transform?: StepSnapshot[]
}

function found(rule: MarkRuleId, slot: string, message: string): OwnProblem {
  return { rule, level: MARK_RULES[rule], slot, message }
}

function markTypeOf(mark: MarkSnapshot) {
  return mark.mark ?? DEFAULT_MARK_TYPE
}

function stepsOf(mark: MarkSnapshot) {
  return mark.transform ?? []
}

function rampColor(mark: MarkSnapshot) {
  const color = mark.encoding?.color ?? {}
  const painted = paintedScale(
    { scale: color.scale, field: color.field ?? '' },
    'categorical',
  )
  return painted === 'linear' || painted === 'log' ? color : undefined
}

function drawsDensity(mark: MarkSnapshot) {
  return mark.source === 'density' && readsValue(markTypeOf(mark))
}

function drawTogether(a: MarkSnapshot, b: MarkSnapshot) {
  const upper = (m: MarkSnapshot) => m.maxBpPerPx || Infinity
  const lower = (m: MarkSnapshot) => m.minBpPerPx ?? 0
  return lower(a) < upper(b) && lower(b) < upper(a)
}

type BinSnapshot = Extract<StepSnapshot, { type: 'bin' }>

// The field names a step reads, by the slot each is written in.
function fieldRefs(step: StepSnapshot): [string, string | undefined][] {
  const list = (slot: string, refs: readonly string[] = []) =>
    refs.map((ref, k): [string, string] => [`${slot}.${k}`, ref])
  switch (step.type) {
    case 'bin':
    case 'flatten':
      return [['field', step.field]]
    case 'pileup':
      return list('fields', step.fields)
    case 'aggregate':
      return [
        ...list('groupby', step.groupby),
        ...(step.ops ?? []).map((o, k): [string, string | undefined] => [
          `ops.${k}.field`,
          o.field,
        ]),
      ]
    default:
      return []
  }
}

// A slot naming two fields, and the default it reads as when it names another
// number of them.
function pairSlot(step: StepSnapshot) {
  return step.type === 'bin'
    ? { slot: 'as', names: step.as, fallback: DEFAULT_BIN_AS }
    : step.type === 'pileup'
      ? { slot: 'fields', names: step.fields, fallback: DEFAULT_PILEUP_FIELDS }
      : undefined
}

type Steps = readonly (StepSnapshot | undefined)[]

function readable(steps: Steps): StepSnapshot[] {
  return steps.filter(s => s !== undefined)
}

function packsIn(steps: Steps) {
  return steps.some(s => s?.type === 'pileup')
}

function packs(mark: MarkSnapshot) {
  return packsIn(stepsOf(mark))
}

// Whether the last pileup of a step list still has its rows on the features
// at the end, as the worker's `layerRow` reads it: an aggregate or coverage
// after it makes features from nothing.
function pileupSurvives(steps: readonly StepSnapshot[]) {
  return (
    steps.findLast(
      s =>
        s.type === 'pileup' || s.type === 'aggregate' || s.type === 'coverage',
    )?.type === 'pileup'
  )
}

function named(field: unknown) {
  return typeof field === 'string' && field !== ''
}

const ONE_ROW_PER_VALUE =
  "rows draws one row per value, so the rows a pileup packs share their value's row; a facet gives each value a section as deep as its pileup"

// Where a display drawing one row per value packs more than one.
function packingsUnderRows(
  marks: readonly (MarkSnapshot | undefined)[],
  transform: Steps,
  section: Steps,
): MarkProblem[] {
  const pileups = (steps: Steps, list: string) =>
    steps.flatMap((step, i) =>
      step?.type === 'pileup'
        ? [found('packing-under-rows', `${list}.${i}`, ONE_ROW_PER_VALUE)]
        : [],
    )
  return [
    ...pileups(transform, 'transform'),
    ...pileups(section, 'facet.transform'),
    ...marks.flatMap((mark, i) =>
      mark
        ? [
            ...pileups(stepsOf(mark), 'transform'),
            ...(mark.encoding?.row
              ? [found('packing-under-rows', 'encoding.row', ONE_ROW_PER_VALUE)]
              : []),
          ].map(p => ({ mark: i, ...p }))
        : [],
    ),
  ]
}

function banded(mark: MarkSnapshot, shared: readonly StepSnapshot[]) {
  return !!mark.encoding?.row || pileupSurvives([...shared, ...stepsOf(mark)])
}

// The fields the last step that makes its features from nothing leaves behind,
// with what the steps after it add, over the display's steps and then the
// mark's; undefined where no step does, and every field of the file is still
// there.
function madeFields(steps: readonly StepSnapshot[]) {
  const made = steps.findLastIndex(
    s => s.type === 'aggregate' || s.type === 'coverage',
  )
  const last = steps[made]
  if (!last) {
    return undefined
  }
  const fields = new Set(['refName', 'start', 'end'])
  if (last.type === 'coverage') {
    fields.add(last.as ?? DEFAULT_COVERAGE_AS)
  } else if (last.type === 'aggregate') {
    const bin = steps
      .slice(0, made)
      .findLast((s): s is BinSnapshot => s.type === 'bin')
    const edges = bin?.as ?? DEFAULT_BIN_AS
    for (const field of last.groupby?.length
      ? last.groupby
      : edges.length === 2
        ? edges
        : []) {
      fields.add(field)
    }
    for (const { op = DEFAULT_AGGREGATE_OP, field, as } of last.ops ?? []) {
      fields.add(aggregateFieldName({ op, field, as }))
    }
  }
  for (const step of steps.slice(made + 1)) {
    if (step.type === 'formula') {
      fields.add(step.as ?? DEFAULT_FORMULA_AS)
    } else if (step.type === 'pileup') {
      fields.add(step.as ?? DEFAULT_PILEUP_AS)
    } else if (step.type === 'flatten' && step.index) {
      fields.add(step.index)
    } else if (step.type === 'mate') {
      for (const field of MATE_FIELDS) {
        fields.add(field)
      }
    } else if (step.type === 'bin') {
      for (const edge of step.as?.length === 2 ? step.as : DEFAULT_BIN_AS) {
        fields.add(edge)
      }
    }
  }
  return fields
}

// What a list of steps cannot run as written, a mark's, the facet's or the
// display's, each slot under the list's own name.
function stepProblems(steps: Steps, list = 'transform') {
  const problems: OwnProblem[] = []
  for (const [i, step] of steps.entries()) {
    if (!step) {
      continue
    }
    const { type } = step
    const at = `${list}.${i}`
    if ((type === 'filter' || type === 'formula') && !isJexl(step.expr ?? '')) {
      problems.push(
        found(
          'step-expression',
          `${at}.expr`,
          `a ${type} reads a jexl: expression`,
        ),
      )
    }
    if (
      type === 'bin' &&
      step.step !== undefined &&
      step.step !== AUTO_BIN &&
      !(Number(step.step) > 0)
    ) {
      problems.push(
        found('bin-width', `${at}.step`, 'a bin is a positive width in bp'),
      )
    }
    const pair = pairSlot(step)
    if (pair?.names && pair.names.length !== 2) {
      problems.push(
        found(
          'step-pair',
          `${at}.${pair.slot}`,
          `a ${type} reads two field names from ${pair.slot} and this names ${pair.names.length}, so it reads ${pair.fallback.join(' and ')}`,
        ),
      )
    }
    if (type === 'aggregate') {
      for (const [k, { op = DEFAULT_AGGREGATE_OP, field }] of (
        step.ops ?? []
      ).entries()) {
        if (op !== 'count' && !field) {
          problems.push(
            found(
              'op-field',
              `${at}.ops.${k}.field`,
              `${op} reads a field and names none`,
            ),
          )
        }
      }
    }
    for (const [slot, ref] of fieldRefs(step)) {
      if (ref && isJexl(ref)) {
        problems.push(
          found(
            'step-field-expression',
            `${at}.${slot}`,
            `the ${type} step reads a field name or a dotted path; a formula step in front computes one`,
          ),
        )
      }
    }
  }
  return problems
}

function ownProblems(
  mark: MarkSnapshot,
  display: readonly StepSnapshot[],
  section: readonly StepSnapshot[],
) {
  const type = markTypeOf(mark)
  const problems: OwnProblem[] = []
  const y = mark.encoding?.y
  const channels = new Set<string>(['x', 'x2', ...MARK_SPECS[type].channels])
  for (const channel of Object.keys(mark.encoding ?? {})) {
    if (!channels.has(channel)) {
      problems.push(
        found(
          'unread-channel',
          `encoding.${channel}`,
          `a ${type} does not read ${channel}`,
        ),
      )
    }
  }
  if (mark.size !== undefined && type !== 'point') {
    problems.push(
      found(
        'unread-size',
        'size',
        `a ${type} draws no point, so it reads no size`,
      ),
    )
  }
  if (!readsValue(type) && mark.source === 'density') {
    problems.push(
      found(
        'span-density-source',
        'source',
        `a ${type} does not draw the density sidecar`,
      ),
    )
  }
  const color = mark.encoding?.color ?? {}
  for (const { rule, slot, message } of colorProblems(color, 'categorical')) {
    problems.push(found(rule, `encoding.color.${slot}`, message))
  }
  const ramp = rampColor(mark)
  if (ramp) {
    const { domainMin, domainMax } = ramp
    if (
      rampResolvesPerRegion(type) &&
      (domainMin === undefined || domainMax === undefined)
    ) {
      problems.push(
        found(
          'unpinned-span-ramp',
          `encoding.color.${domainMin === undefined ? 'domainMin' : 'domainMax'}`,
          `a ${type}'s ramp resolves an open end against each region's own extremes, so its colours agree across regions only with domainMin and domainMax both pinned`,
        ),
      )
    }
  }
  const { minBpPerPx = 0, maxBpPerPx = 0 } = mark
  if (minBpPerPx > 0 && maxBpPerPx > 0 && minBpPerPx >= maxBpPerPx) {
    problems.push(
      found(
        'empty-zoom-range',
        'minBpPerPx',
        `never draws: minBpPerPx ${minBpPerPx} is not below maxBpPerPx ${maxBpPerPx}`,
      ),
    )
  }
  problems.push(...stepProblems(stepsOf(mark)))
  if (packs(mark) && (packsIn(section) || packsIn(display))) {
    problems.push(
      found(
        'two-packings',
        'transform',
        `packs rows of its own over the ${packsIn(section) ? "facet's" : "display's"} pileup, and the two share row numbers; one pileup packs every mark`,
      ),
    )
  }
  const fields = madeFields([...display, ...section, ...stepsOf(mark)])
  if (fields && y && !isJexl(y) && !fields.has(y)) {
    problems.push(
      found(
        'unwritten-y',
        'encoding.y',
        `reads "${y}", which no step before it writes; they leave ${[...fields].join(', ')}`,
      ),
    )
  }
  return problems
}

/**
 * The problems of a `marks` list as a config snapshot holds it: shorthands
 * lifted, defaults left off. `facet` is the display's facet as written, the
 * field its sections stack by and the steps each section runs; under one, a
 * rowless mark stands on each section's first row by design. `transform` is
 * the display's own steps. Both lists are checked as a mark's are and reported
 * with no mark, under `transform` and `facet.transform`. `rows` is the field
 * each value of which takes one row. An `undefined` mark or step is one the
 * caller could not read, such as one a file's schema refuses: it keeps its
 * index, so the others are reported where they are, and is checked for
 * nothing. A file's own spelling goes through the schema's lift first, which
 * `jbrowse validate` does from the generated manifest.
 */
export function markProblems(
  marks: readonly (MarkSnapshot | undefined)[],
  facet?: FacetSnapshot,
  transform: Steps = [],
  rows?: RowsSnapshot,
): MarkProblem[] {
  const faceted = named(facet?.field)
  const drawsRows = named(rows?.field) && !faceted
  const section = readable(facet?.transform ?? [])
  const display = readable(transform)
  const shared = [...display, ...section]
  const problems: MarkProblem[] = [
    ...stepProblems(transform),
    ...stepProblems(facet?.transform ?? [], 'facet.transform'),
    ...(faceted
      ? transform.flatMap((step, i) =>
          step?.type === 'pileup'
            ? [
                found(
                  'cross-section-packing',
                  `transform.${i}`,
                  'runs before the facet splits the features, so it packs across every section and leaves each section the rows the others fill; the same pileup in facet.transform packs each section on its own',
                ),
              ]
            : [],
        )
      : []),
    ...(faceted && named(rows?.field) && rows?.field !== facet?.field
      ? [
          found(
            'rows-beside-facet',
            'rows.field',
            'facet stacks a labelled section per value and rows one row per value; bands of rows over two fields are not drawn yet, so the facet draws alone',
          ),
        ]
      : []),
    ...(drawsRows ? packingsUnderRows(marks, transform, section) : []),
    ...marks.flatMap((mark, i) =>
      mark
        ? ownProblems(mark, display, section).map(p => ({ mark: i, ...p }))
        : [],
    ),
  ]
  for (const [i, mark] of marks.entries()) {
    for (const [j, other] of marks.entries()) {
      if (i === j || !mark || !other || !drawTogether(mark, other)) {
        continue
      }
      if (
        !faceted &&
        !drawsRows &&
        markTypeOf(mark) !== 'span' &&
        !banded(mark, shared) &&
        banded(other, shared)
      ) {
        problems.push({
          mark: i,
          ...found(
            'value-beside-rows',
            'encoding.row',
            `stands in the first of the rows mark ${j} bands the plot into, its axis repeated per row`,
          ),
        })
      }
      if (i > j && packs(mark) && packs(other)) {
        problems.push({
          mark: i,
          ...found(
            'two-packings',
            'transform',
            `packs rows of its own, as mark ${j} does, and the two share row numbers; one pileup in the ${faceted ? "facet's transform packs them together per section" : "display's transform packs them together"}`,
          ),
        })
      }
      if (i > j && drawsDensity(mark) && drawsDensity(other)) {
        problems.push({
          mark: i,
          ...found(
            'second-density-mark',
            'source',
            `mark ${j} already stands in for the density sidecar here`,
          ),
        })
      }
    }
  }
  return problems
}

/**
 * A problem as one line of a notice: `mark 0 encoding.y: …`, or
 * `transform.0.step: …` for the display's own step.
 */
export function problemText({ mark, slot, message }: MarkProblem): string {
  return `${mark === undefined ? '' : `mark ${mark} `}${slot}: ${message}`
}
