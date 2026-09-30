import { AUTO_BIN } from './autoBin.ts'
import {
  FEATURE_FIELD_PRESETS,
  aggregateFieldName,
  colorProblems,
  fieldScaleOf,
  isJexl,
  SHAPE_NAMES,
  isNamedColor,
  paintedScale,
  scaleEndProblems,
  universalPresetOf,
} from './markRuleFacts.ts'
import { MARK_SPECS, rampResolvesPerRegion, readsValue } from './markSpecs.ts'
import {
  DEFAULT_AGGREGATE_OP,
  BIN_OVERLAP_FIELD,
  DEFAULT_BIN_AS,
  DEFAULT_BIN_FIELD,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FORMULA_AS,
  DEFAULT_LINE_INTERPOLATE,
  DEFAULT_ROW_PROPORTION,
  DEFAULT_LINK_SHAPE,
  DEFAULT_MARK_TYPE,
  CELLS_FIELDS,
  DEFAULT_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS,
  DEFAULT_TEXT_FIELD,
  DEFAULT_X2,
  MATE_FIELDS,
} from './markVocabulary.ts'
import { stepChannels } from './stepChannels.ts'

import type { ColorSlots, ScaleEnds } from './markRuleFacts.ts'
import type { MarkChannel, MarkSpec } from './markSpecs.ts'
import type {
  AggregateOpName,
  LineInterpolation,
  LinkShape,
  MarkSourceName,
  MarkType,
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
 * refer to it by.
 */
export const MARK_RULES = {
  /** A bar, point or rule naming no `y`, with no step before it writing one it reads by default. */
  'mark-without-value': 'error',
  /** A channel the mark's type does not read, such as `y` on a `span` or a size field on a point. */
  'unread-channel': 'warning',
  /** An `encoding.size` on a mark that draws no point or rule and strokes no link. */
  'unread-size': 'warning',
  /** A `linkShape` on a mark that draws no link. */
  'unread-link-shape': 'warning',
  /** An `interpolate` on a mark that draws no line. */
  'unread-interpolate': 'warning',
  /** A `rowProportion` on a mark that draws no span. */
  'unread-row-proportion': 'warning',
  /** `source: "density"` on a `span`, a `text` or a `link`, which cannot draw the sidecar's bins. */
  'span-density-source': 'warning',
  /** Threshold cuts that repeat, leaving an interval no value falls in. */
  'threshold-cuts': 'warning',
  /** A threshold colour naming no cut, so every value paints one colour. */
  'threshold-no-cuts': 'warning',
  /** A threshold `range` not one colour longer than its cuts. */
  'threshold-range': 'warning',
  /** A `domain` on a linear or log colour, whose ends are `domainMin` and `domainMax`. */
  'ramp-domain': 'warning',
  /** A scale's `domainMax` below its `domainMin`: a colour ramp's, a width's or `scales.y`'s. */
  'domain-ends': 'warning',
  /** A colour ramp's or `scales.y`'s `domainQuantile` outside 0.5 to 1, a percent among them. */
  'domain-quantile': 'warning',
  /** A colour's or a shape's `field` spelling a CSS colour or a shape name, which is a constant written `{ value }`. */
  'field-spells-constant': 'warning',
  /** A colour's or a shape's `labels` naming values its `domain` does not list, or no categorical scale's. */
  'labels-domain': 'warning',
  /** A text's colour ramp with an open end, whose colours then differ from one region to the next. */
  'unpinned-text-ramp': 'warning',
  /** A `minBpPerPx` not below the mark's `maxBpPerPx`, so the mark never draws. */
  'empty-zoom-range': 'error',
  /** A `filter` or `formula` whose `expr` is not a `jexl:` expression. */
  'step-expression': 'error',
  /** A `bin` whose `step` is neither `"auto"` nor a positive width. */
  'bin-width': 'error',
  /** A `bin`'s `as` or `fields`, or a `pileup`'s `fields`, naming other than two fields, so the step reads its defaults. */
  'step-pair': 'warning',
  /** A `bin` naming a `field` beside the `fields` it cuts at the bin edges, which leaves the `field` unread. */
  'bin-field-and-fields': 'warning',
  /** A `sum`, `mean`, `min` or `max` naming no `field`. */
  'op-field': 'error',
  /** A `weight` on a `min` or a `max`, which no weight moves. */
  'unread-weight': 'warning',
  /** A step's field written as a `jexl:` expression, where a step reads a name or a dotted path. */
  'step-field-expression': 'error',
  /** A `y` naming a field that no `aggregate` or `coverage` step before it writes. */
  'unwritten-y': 'error',
  /** Another channel naming a field that no `aggregate` or `coverage` step before it writes, so it reads no value; the field a `facet` or `rows` splits on counts as written. */
  'unwritten-field': 'warning',
  /** A mark other than a span drawn beside one that stacks rows, standing in the first of them. */
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
  weight?: string
  as?: string
}

/** One `transform` step as a config snapshot holds it, defaults left off. */
export type StepSnapshot =
  | { type: 'filter'; expr?: string }
  | { type: 'formula'; expr?: string; as?: string }
  | {
      type: 'bin'
      step?: number | string
      field?: string
      fields?: string[]
      as?: string[]
    }
  | { type: 'aggregate'; groupby?: string[]; ops?: OpSnapshot[] }
  | { type: 'coverage'; as?: string }
  | {
      type: 'flatten'
      field?: string
      index?: string
      key?: string
      keepEmpty?: boolean
    }
  | { type: 'cells'; field?: string }
  | { type: 'pileup'; as?: string; fields?: string[]; padding?: number }
  | { type: 'mate' }

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

/** The display's `scales` as a config snapshot holds it: the value scale's ends. */
export interface ScalesSnapshot {
  y?: ScaleEnds
}

/**
 * One entry of a `marks` list as a config snapshot holds it, defaults left
 * off. A type alias, which a `Record<string, unknown>` reader takes.
 */
export type MarkSnapshot = {
  mark?: MarkType
  linkShape?: LinkShape
  interpolate?: LineInterpolation
  rowProportion?: number
  source?: MarkSourceName
  minBpPerPx?: number
  maxBpPerPx?: number
  encoding?: {
    x?: string
    x2?: string | { pos?: string; chrom?: string }
    y?: string
    row?: string
    color?: ColorSlots
    shape?: unknown
    text?: string
    size?: number | string | ({ value?: number; field?: string } & ScaleEnds)
  }
  transform?: StepSnapshot[]
}

function found(rule: MarkRuleId, slot: string, message: string): OwnProblem {
  return { rule, level: MARK_RULES[rule], slot, message }
}

function markTypeOf(mark: MarkSnapshot) {
  return mark.mark ?? DEFAULT_MARK_TYPE
}

// Whether a slot holds nothing a reader could act on: unset, empty text, an
// empty list, or an object none of whose members holds anything.
function unwritten(value: unknown): boolean {
  return (
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' &&
      value !== null &&
      Object.values(value).every(unwritten))
  )
}

// Whether a channel is written as its default, which a display's snapshot
// leaves off and a file may spell out: the two read alike, so a slot at its
// default is no channel for a rule to find unread.
function atDefault(channel: string, value: unknown) {
  switch (channel) {
    case 'x':
      return value === DEFAULT_BIN_AS[0]
    case 'x2':
      return (
        value === DEFAULT_X2 ||
        (typeof value === 'object' &&
          value !== null &&
          unwritten((value as { chrom?: unknown }).chrom) &&
          ((value as { pos?: unknown }).pos === DEFAULT_X2 ||
            unwritten((value as { pos?: unknown }).pos)))
      )
    case 'text':
      return value === DEFAULT_TEXT_FIELD
    default:
      return false
  }
}

/** The channels a mark's encoding writes, less those at their default. */
function writtenChannels(encoding: MarkSnapshot['encoding']) {
  return Object.entries(encoding ?? {})
    .filter(
      ([channel, value]) => !unwritten(value) && !atDefault(channel, value),
    )
    .map(([channel]) => channel)
}

function stepsOf(mark: MarkSnapshot) {
  return mark.transform ?? []
}

function colorScaleOf({ scale, field = '' }: ColorSlots) {
  return paintedScale(
    { scale, field },
    fieldScaleOf(FEATURE_FIELD_PRESETS, field),
  )
}

function rampColor(mark: MarkSnapshot) {
  const color = mark.encoding?.color ?? {}
  const painted = colorScaleOf(color)
  return painted === 'linear' || painted === 'log' ? color : undefined
}

type SizeSnapshot = NonNullable<NonNullable<MarkSnapshot['encoding']>['size']>

function sizeFieldOf(size: SizeSnapshot | undefined) {
  return typeof size === 'string'
    ? size
    : typeof size === 'object'
      ? (size.field ?? '')
      : ''
}

// A shape's labels name its domain values in order, as a colour's do, and a
// constant shape names none.
// What a reader writes as a colour, without the colour parser the rule list
// cannot carry into `jbrowse validate`.
function spellsColor(text: string) {
  return (
    /^(#[\da-f]{3,8}|(rgb|hsl|hwb|lab|lch|oklab|oklch|color)a?\(.*\)|transparent)$/i.test(
      text,
    ) || isNamedColor(text.toLowerCase())
  )
}

function fieldOf(channel: unknown) {
  const field =
    typeof channel === 'object' && channel !== null
      ? (channel as { field?: unknown }).field
      : channel
  return typeof field === 'string' && !isJexl(field) ? field : ''
}

// Inside `encoding` a bare string is a field, so a constant written the way a
// display-level colour takes one reads as a field no feature holds.
function constantAsFieldProblems(
  encoding: MarkSnapshot['encoding'],
): OwnProblem[] {
  const color = fieldOf(encoding?.color)
  const shape = fieldOf(encoding?.shape)
  return [
    ...(color && spellsColor(color)
      ? [
          found(
            'field-spells-constant',
            'encoding.color.field',
            `${JSON.stringify(color)} is a colour, and a string in encoding is a field: a constant colour is { "value": ${JSON.stringify(color)} }`,
          ),
        ]
      : []),
    ...(shape && (SHAPE_NAMES as readonly string[]).includes(shape)
      ? [
          found(
            'field-spells-constant',
            'encoding.shape.field',
            `${JSON.stringify(shape)} is a shape, and a string in encoding is a field: a constant shape is { "value": ${JSON.stringify(shape)} }`,
          ),
        ]
      : []),
  ]
}

function shapeLabelProblems(shape: unknown): OwnProblem[] {
  if (typeof shape !== 'object' || shape === null) {
    return []
  }
  const { field = '', scale, domain = [], labels = [] } = shape as ColorSlots
  // an unwritten domain pairs the labels with the field's own order, as the
  // key and the worker do
  const order =
    domain.length > 0 ? domain : (universalPresetOf(field)?.domain ?? [])
  const named =
    paintedScale({ scale, field }, 'categorical') === 'categorical'
      ? order.length
      : 0
  return labels.length > named
    ? [
        found(
          'labels-domain',
          'encoding.shape.labels',
          `labels names one domain value each, and ${labels.length} ${labels.length === 1 ? 'label names' : 'labels name'} ${named}: a label past them names nothing`,
        ),
      ]
    : []
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
      return [['field', step.field], ...list('fields', step.fields)]
    case 'flatten':
    case 'cells':
      return [['field', step.field]]
    case 'pileup':
      return list('fields', step.fields)
    case 'aggregate':
      return [
        ...list('groupby', step.groupby),
        ...(step.ops ?? []).flatMap((o, k): [string, string | undefined][] => [
          [`ops.${k}.field`, o.field],
          [`ops.${k}.weight`, o.weight],
        ]),
      ]
    default:
      return []
  }
}

// The slots naming two fields, and what each reads as when it names another
// number of them: a bin's `fields` left empty is a bin by `field`.
function pairSlots(step: StepSnapshot) {
  return step.type === 'bin'
    ? [
        { slot: 'as', names: step.as, reads: DEFAULT_BIN_AS.join(' and ') },
        {
          slot: 'fields',
          names: step.fields?.length ? step.fields : undefined,
          reads: `its field alone, ${step.field || DEFAULT_BIN_FIELD}`,
        },
      ]
    : step.type === 'pileup'
      ? [
          {
            slot: 'fields',
            names: step.fields,
            reads: DEFAULT_PILEUP_FIELDS.join(' and '),
          },
        ]
      : []
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
  return (
    !!mark.encoding?.row ||
    stepChannels([...shared, ...stepsOf(mark)]).row !== undefined
  )
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
    } else if (step.type === 'flatten') {
      for (const field of [step.index, step.key]) {
        if (field) {
          fields.add(field)
        }
      }
    } else if (step.type === 'mate') {
      for (const field of MATE_FIELDS) {
        fields.add(field)
      }
    } else if (step.type === 'cells') {
      for (const field of CELLS_FIELDS) {
        fields.add(field)
      }
    } else if (step.type === 'bin') {
      for (const edge of step.as?.length === 2 ? step.as : DEFAULT_BIN_AS) {
        fields.add(edge)
      }
      if (step.fields?.length === 2) {
        fields.add(BIN_OVERLAP_FIELD)
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
    for (const pair of pairSlots(step)) {
      if (pair.names && pair.names.length !== 2) {
        problems.push(
          found(
            'step-pair',
            `${at}.${pair.slot}`,
            `a ${type} reads two field names from ${pair.slot} and this names ${pair.names.length}, so it reads ${pair.reads}`,
          ),
        )
      }
    }
    if (
      type === 'bin' &&
      step.fields?.length === 2 &&
      step.field &&
      step.field !== DEFAULT_BIN_FIELD
    ) {
      problems.push(
        found(
          'bin-field-and-fields',
          `${at}.field`,
          `a bin over fields cuts each interval at the bin edges and reads no field, so ${step.field} is unread`,
        ),
      )
    }
    if (type === 'aggregate') {
      for (const [k, { op = DEFAULT_AGGREGATE_OP, field, weight }] of (
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
        if ((op === 'min' || op === 'max') && weight) {
          problems.push(
            found(
              'unread-weight',
              `${at}.ops.${k}.weight`,
              `a weight moves no ${op === 'min' ? 'minimum' : 'maximum'}, so the ${op} reads its field alone`,
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

// Each field a mark's channels read besides `y`, by the slot naming it: the
// channels its type reads, a colour's or a shape's field where it is a scale,
// a text's field as its default leaves it, and a link's size field.
function channelFields(
  mark: MarkSnapshot,
  spec: MarkSpec,
): [slot: string, field: string][] {
  const encoding = mark.encoding ?? {}
  const { x, x2, row, color = {}, shape, text = DEFAULT_TEXT_FIELD } = encoding
  const reads = (channel: MarkChannel) => spec.channels.includes(channel)
  const named: [string, string | undefined][] = [
    ['encoding.x', x],
    ['encoding.x2', typeof x2 === 'string' ? x2 : x2?.pos],
    ['encoding.x2.chrom', typeof x2 === 'object' ? x2.chrom : undefined],
    ['encoding.row', reads('row') ? row : undefined],
    [
      'encoding.color.field',
      reads('color') && colorScaleOf(color) !== 'none'
        ? fieldOf(color)
        : undefined,
    ],
    ['encoding.shape.field', reads('shape') ? fieldOf(shape) : undefined],
    ['encoding.text', reads('text') ? text : undefined],
    [
      'encoding.size.field',
      spec.size === 'channel' ? sizeFieldOf(encoding.size) : undefined,
    ],
  ]
  return named.flatMap(([slot, field]) =>
    field && !isJexl(field) ? [[slot, field]] : [],
  )
}

function ownProblems(
  mark: MarkSnapshot,
  display: readonly StepSnapshot[],
  section: readonly StepSnapshot[],
  split?: string,
) {
  const type = markTypeOf(mark)
  const problems: OwnProblem[] = []
  const y = mark.encoding?.y
  if (
    readsValue(type) &&
    !y &&
    !stepChannels([...display, ...section, ...stepsOf(mark)]).y
  ) {
    problems.push(
      found(
        'mark-without-value',
        'encoding.y',
        `a ${type} stands at a value, and names no y field while no step before it writes one — a coverage, or an aggregate with one op — so it draws nothing`,
      ),
    )
  }
  const spec: MarkSpec = MARK_SPECS[type]
  const channels = new Set<string>(['x', 'x2', 'size', ...spec.channels])
  for (const channel of writtenChannels(mark.encoding)) {
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
  const size = mark.encoding?.size
  if (!unwritten(size) && spec.size === undefined) {
    problems.push(
      found(
        'unread-size',
        'encoding.size',
        `a ${type} draws no point or rule and strokes no link, so it reads no size`,
      ),
    )
  } else if (spec.size === 'constant' && sizeFieldOf(size)) {
    problems.push(
      found(
        'unread-channel',
        'encoding.size.field',
        `a ${type} reads its size as a number, and only a link maps a field to it`,
      ),
    )
  }
  if (
    mark.linkShape !== undefined &&
    mark.linkShape !== DEFAULT_LINK_SHAPE &&
    type !== 'link'
  ) {
    problems.push(
      found(
        'unread-link-shape',
        'linkShape',
        `a ${type} draws no link, so it reads no linkShape`,
      ),
    )
  }
  if (
    mark.interpolate !== undefined &&
    mark.interpolate !== DEFAULT_LINE_INTERPOLATE &&
    type !== 'line'
  ) {
    problems.push(
      found(
        'unread-interpolate',
        'interpolate',
        `a ${type} draws no line, so it reads no interpolate`,
      ),
    )
  }
  if (
    mark.rowProportion !== undefined &&
    mark.rowProportion !== DEFAULT_ROW_PROPORTION &&
    type !== 'span'
  ) {
    problems.push(
      found(
        'unread-row-proportion',
        'rowProportion',
        `a ${type} draws no span, so it reads no rowProportion`,
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
  for (const { rule, slot, message } of colorProblems(
    color,
    FEATURE_FIELD_PRESETS,
  )) {
    problems.push(found(rule, `encoding.color.${slot}`, message))
  }
  if (
    colorScaleOf(color) === 'threshold' &&
    (color.domain ?? []).length === 0
  ) {
    problems.push(
      found(
        'threshold-no-cuts',
        'encoding.color.domain',
        'a threshold names its cut points in domain, and with none every value paints the first colour',
      ),
    )
  }
  problems.push(...shapeLabelProblems(mark.encoding?.shape))
  problems.push(...constantAsFieldProblems(mark.encoding))
  if (typeof size === 'object') {
    for (const { rule, slot, message } of scaleEndProblems(size)) {
      problems.push(found(rule, `encoding.size.${slot}`, message))
    }
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
          'unpinned-text-ramp',
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
  if (fields) {
    if (split) {
      fields.add(split)
    }
    const leaves = `which no step before it writes; they leave ${[...fields].join(', ')}`
    if (y && !isJexl(y) && !fields.has(y)) {
      problems.push(
        found('unwritten-y', 'encoding.y', `reads "${y}", ${leaves}`),
      )
    }
    for (const [slot, field] of channelFields(mark, spec)) {
      if (!fields.has(field)) {
        problems.push(
          found('unwritten-field', slot, `reads "${field}", ${leaves}`),
        )
      }
    }
  }
  return problems
}

/**
 * A plot as a config snapshot holds it, shorthands lifted and defaults left
 * off: the `marks` list and the display's own settings they read. `facet` is
 * the field its sections stack by and the steps each section runs; under one,
 * a rowless mark stands on each section's first row by design. `transform` is
 * the display's own steps. `rows` is the field each value of which takes one
 * row, and `scales` the axis every mark's `y` reads through. An `undefined`
 * mark or step is one the caller could not read, such as one a file's schema
 * refuses: it keeps its index, so the others are reported where they are, and
 * is checked for nothing.
 */
export interface PlotSnapshot {
  marks: readonly (MarkSnapshot | undefined)[]
  transform?: Steps
  facet?: FacetSnapshot
  rows?: RowsSnapshot
  scales?: ScalesSnapshot
}

/**
 * Every rule a plot breaks. The display's step lists are checked as a mark's
 * are and reported with no mark, under `transform` and `facet.transform`, and
 * so are `scales.y`'s ends. A file's own spelling goes through the schema's
 * lift first, which `jbrowse validate` does from the generated manifest.
 */
export function markProblems({
  marks,
  facet,
  transform = [],
  rows,
  scales,
}: PlotSnapshot): MarkProblem[] {
  const faceted = named(facet?.field)
  const drawsRows = named(rows?.field) && !faceted
  // the field the sections or rows are split on, which every section's rows
  // keep through the steps that make rows
  const split = faceted ? facet?.field : drawsRows ? rows?.field : undefined
  const section = readable(facet?.transform ?? [])
  const display = readable(transform)
  const shared = [...display, ...section]
  const problems: MarkProblem[] = [
    ...stepProblems(transform),
    ...stepProblems(facet?.transform ?? [], 'facet.transform'),
    ...scaleEndProblems(scales?.y ?? {}).map(({ rule, slot, message }) =>
      found(rule, `scales.y.${slot}`, message),
    ),
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
        ? ownProblems(mark, display, section, split).map(p => ({
            mark: i,
            ...p,
          }))
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
