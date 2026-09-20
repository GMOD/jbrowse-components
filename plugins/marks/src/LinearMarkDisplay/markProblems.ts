import { isJexl } from '@jbrowse/core/util/jexlStrings'

import { AUTO_BIN } from './autoBin.ts'
import { markColorScale } from './markColorConfigSchema.ts'
import { SHAPE_LANES } from './shapeLanes.ts'

import type { MarkColorScale } from './markColorConfigSchema.ts'

/**
 * What a `marks` list says that the display cannot draw as written: the mark,
 * the slot to look at, and why. A problem is a combination of slots, which a
 * load cannot refuse: the config editor writes one slot at a time, so moving a
 * bar to a span passes through a span that still names a `y`, and a refusal
 * there drops the track from the session it was saved in (ADR-133). The
 * display draws what it can and says the rest in its corner notice.
 */
export interface MarkProblem {
  mark: number
  slot: string
  message: string
}

interface StepSnapshot {
  type?: string
  expr?: string
  step?: number | string
  as?: string[] | string
  groupby?: string[]
  ops?: { op?: string; field?: string; as?: string }[]
}

interface MarkSnapshot {
  shape?: string
  source?: string
  minBpPerPx?: number
  maxBpPerPx?: number
  encoding?: Record<string, unknown> & { y?: string; row?: string }
  transform?: StepSnapshot[]
}

const SHAPE_CHANNELS: Record<string, string[]> = Object.fromEntries(
  Object.entries(SHAPE_LANES).map(([shape, lanes]) => [
    shape,
    ['x', 'x2', ...lanes.filter(l => l !== 'index' && l !== 'colorValue')],
  ]),
)

function shapeOf(mark: MarkSnapshot) {
  return mark.shape ?? 'bar'
}

function stepsOf(mark: MarkSnapshot) {
  return mark.transform ?? []
}

function listOf(as: StepSnapshot['as']) {
  return as === undefined ? [] : typeof as === 'string' ? [as] : as
}

function rampDomain(mark: MarkSnapshot) {
  const color = mark.encoding?.color
  if (typeof color !== 'object' || color === null) {
    return undefined
  }
  const {
    field = '',
    scale,
    ramp = [],
    domain = [],
  } = color as {
    field?: string
    scale?: MarkColorScale
    ramp?: string[]
    domain?: unknown[]
  }
  const painted = markColorScale({ scale, field, ramp })
  return painted === 'linear' || painted === 'log' ? domain : undefined
}

function pinned(entry: unknown) {
  return entry !== '' && Number.isFinite(Number(entry))
}

/** A ramp's declared domain as the [min, max] it pins, or nothing where it pins none. */
export function pinnedPair(
  domain: readonly unknown[],
): [number, number] | undefined {
  return domain.length === 2 && domain.every(pinned)
    ? [Number(domain[0]), Number(domain[1])]
    : undefined
}

function drawTogether(a: MarkSnapshot, b: MarkSnapshot) {
  const upper = (m: MarkSnapshot) => m.maxBpPerPx || Infinity
  const lower = (m: MarkSnapshot) => m.minBpPerPx ?? 0
  return lower(a) < upper(b) && lower(b) < upper(a)
}

function stacks(mark: MarkSnapshot) {
  return stepsOf(mark).some(s => s.type === 'stack')
}

function banded(mark: MarkSnapshot) {
  return stacks(mark) || !!mark.encoding?.row
}

// The fields the last step that makes its features from nothing leaves behind,
// with what the steps after it add; undefined where no step does, and every
// field of the file is still there.
function madeFields(mark: MarkSnapshot) {
  const steps = stepsOf(mark)
  const made = steps.findLastIndex(
    s => s.type === 'aggregate' || s.type === 'coverage',
  )
  const last = steps[made]
  if (!last) {
    return undefined
  }
  const fields = new Set(['refName', 'start', 'end'])
  if (last.type === 'coverage') {
    fields.add(listOf(last.as)[0] ?? 'coverage')
  } else {
    const bin = steps.slice(0, made).findLast(s => s.type === 'bin')
    const edges = bin ? listOf(bin.as) : []
    for (const field of last.groupby?.length
      ? last.groupby
      : edges.length === 2
        ? edges
        : []) {
      fields.add(field)
    }
    for (const { op = 'count', field, as } of last.ops ?? []) {
      fields.add(as || (op === 'count' || !field ? op : `${op}_${field}`))
    }
  }
  for (const step of steps.slice(made + 1)) {
    const [as] = listOf(step.as)
    if (step.type === 'formula') {
      fields.add(as ?? 'value')
    } else if (step.type === 'stack') {
      fields.add(as ?? 'row')
    } else if (step.type === 'flatten' && as) {
      fields.add(as)
    }
  }
  return fields
}

function ownProblems(mark: MarkSnapshot): Omit<MarkProblem, 'mark'>[] {
  const shape = shapeOf(mark)
  const problems: Omit<MarkProblem, 'mark'>[] = []
  const y = mark.encoding?.y
  if ((shape === 'bar' || shape === 'point') && !y) {
    problems.push({
      slot: 'encoding.y',
      message: `a ${shape} stands at a value and names no field to plot, so it draws nothing`,
    })
  }
  const channels = SHAPE_CHANNELS[shape] ?? []
  for (const channel of Object.keys(mark.encoding ?? {})) {
    if (!channels.includes(channel)) {
      problems.push({
        slot: `encoding.${channel}`,
        message: `a ${shape} does not read ${channel}`,
      })
    }
  }
  if (shape === 'span' && mark.source === 'density') {
    problems.push({
      slot: 'source',
      message: 'a span does not draw the density sidecar',
    })
  }
  const domain = rampDomain(mark)
  if (domain) {
    const pair = pinnedPair(domain) !== undefined
    if (domain.length > 0 && !pair) {
      problems.push({
        slot: 'encoding.color.domain',
        message:
          'a ramp is pinned by [min, max], two finite numbers, and anything else is not read as written',
      })
    } else if (shape === 'span' && !pair) {
      problems.push({
        slot: 'encoding.color.domain',
        message:
          "a span's ramp resolves against each region's own extremes, so its colours agree across regions only under a pinned [min, max]",
      })
    }
  }
  const { minBpPerPx = 0, maxBpPerPx = 0 } = mark
  if (minBpPerPx > 0 && maxBpPerPx > 0 && minBpPerPx >= maxBpPerPx) {
    problems.push({
      slot: 'minBpPerPx',
      message: `never draws: minBpPerPx ${minBpPerPx} is not below maxBpPerPx ${maxBpPerPx}`,
    })
  }
  for (const [i, step] of stepsOf(mark).entries()) {
    const type = step.type ?? 'filter'
    if ((type === 'filter' || type === 'formula') && !isJexl(step.expr ?? '')) {
      problems.push({
        slot: `transform.${i}.expr`,
        message: `a ${type} reads a jexl: expression`,
      })
    }
    if (
      type === 'bin' &&
      step.step !== undefined &&
      step.step !== AUTO_BIN &&
      !(Number(step.step) > 0)
    ) {
      problems.push({
        slot: `transform.${i}.step`,
        message: 'a bin is a positive width in bp',
      })
    }
    for (const [k, { op = 'count', field }] of (step.ops ?? []).entries()) {
      if (type === 'aggregate' && op !== 'count' && !field) {
        problems.push({
          slot: `transform.${i}.ops.${k}.field`,
          message: `${op} reads a field and names none`,
        })
      }
    }
  }
  const fields = madeFields(mark)
  if (fields && y && !isJexl(y) && !fields.has(y)) {
    problems.push({
      slot: 'encoding.y',
      message: `reads "${y}", which its steps do not write; they leave ${[...fields].join(', ')}`,
    })
  }
  return problems
}

/**
 * The problems of a `marks` list as a config snapshot holds it, defaults left
 * off. `faceted` is whether the display splits its rows by a facet, under
 * which a rowless mark stands on each section's first row by design.
 */
export function markProblems(
  marks: readonly MarkSnapshot[],
  faceted: boolean,
): MarkProblem[] {
  const problems = marks.flatMap((mark, i) =>
    ownProblems(mark).map(p => ({ mark: i, ...p })),
  )
  for (const [i, mark] of marks.entries()) {
    for (const [j, other] of marks.entries()) {
      if (i === j || !drawTogether(mark, other)) {
        continue
      }
      if (
        !faceted &&
        shapeOf(mark) !== 'span' &&
        !banded(mark) &&
        banded(other)
      ) {
        problems.push({
          mark: i,
          slot: 'encoding.row',
          message: `stands in the first of the rows mark ${j} bands the plot into, its axis repeated per row`,
        })
      }
      if (i > j && stacks(mark) && stacks(other)) {
        problems.push({
          mark: i,
          slot: 'transform',
          message: `packs rows of its own, as mark ${j} does, and the two share row numbers; one stack in the display's transform packs them together`,
        })
      }
      if (i > j && mark.source === 'density' && other.source === 'density') {
        problems.push({
          mark: i,
          slot: 'source',
          message: `mark ${j} already stands in for the density sidecar here`,
        })
      }
    }
  }
  return problems
}

/** A problem as one line of a notice: `mark 0 encoding.y: …`. */
export function problemText({ mark, slot, message }: MarkProblem) {
  return `mark ${mark} ${slot}: ${message}`
}
