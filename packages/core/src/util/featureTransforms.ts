import { stringToJexlExpression } from './jexlStrings.ts'
import SimpleFeature, { buildJexlContext } from './simpleFeature.ts'

import type { JexlInstance } from './jexlStrings.ts'
import type {
  AggregateOp,
  AggregateStep,
  BinStep,
  CoverageStep,
  TransformStep,
} from './markEncodingTypes.ts'
import type { Feature, SimpleFeatureSerialized } from './simpleFeature.ts'

export const DEFAULT_BIN_AS: [string, string] = ['start', 'end']
export const DEFAULT_COVERAGE_AS = 'coverage'

/**
 * A feature with fields written over another's: what `formula` and `bin`
 * produce, without copying the base feature's data per step.
 */
class DerivedFeature implements Feature {
  constructor(
    private readonly base: Feature,
    private readonly fields: Record<string, unknown>,
  ) {}

  get(name: 'refName'): string
  get(name: 'start' | 'end'): number
  get(name: string): unknown
  get(name: string) {
    return name in this.fields ? this.fields[name] : this.base.get(name)
  }

  id() {
    return this.base.id()
  }

  parent() {
    return this.base.parent?.()
  }

  children() {
    return this.base.children?.()
  }

  toJSON(): SimpleFeatureSerialized {
    return { ...this.base.toJSON(), ...this.fields }
  }
}

function expression(expr: string, jexl: JexlInstance | undefined) {
  if (!jexl) {
    throw new Error(`a jexl transform needs a jexl instance (${expr})`)
  }
  return stringToJexlExpression(expr, jexl)
}

function filter(
  features: readonly Feature[],
  expr: string,
  jexl: JexlInstance | undefined,
) {
  const compiled = expression(expr, jexl)
  return features.filter(f => compiled.eval(buildJexlContext({ feature: f })))
}

function formula(
  features: readonly Feature[],
  expr: string,
  as: string,
  jexl: JexlInstance | undefined,
) {
  const compiled = expression(expr, jexl)
  return features.map(
    f =>
      new DerivedFeature(f, {
        [as]: compiled.eval(buildJexlContext({ feature: f })),
      }),
  )
}

function bin(features: readonly Feature[], step: BinStep) {
  const { field = 'start', step: size } = step
  if (!(size > 0)) {
    throw new Error(`a bin step needs a positive size (${size})`)
  }
  const [asStart, asEnd] = step.as ?? DEFAULT_BIN_AS
  return features.map(f => {
    const v = Number(f.get(field))
    const start = Math.floor(v / size) * size
    return new DerivedFeature(f, { [asStart]: start, [asEnd]: start + size })
  })
}

export function aggregateFieldName({ op, field, as }: AggregateOp) {
  return as ?? (op === 'count' || field === undefined ? op : `${op}_${field}`)
}

function aggregate(features: readonly Feature[], step: AggregateStep) {
  const { groupby = [], ops } = step
  const groups = new Map<string, Feature[]>()
  for (const f of features) {
    let key = ''
    for (const field of groupby) {
      key += `${String(f.get(field))}\0`
    }
    let members = groups.get(key)
    if (!members) {
      members = []
      groups.set(key, members)
    }
    members.push(f)
  }
  const out: Feature[] = []
  let serial = 0
  for (const members of groups.values()) {
    const first = members[0]!
    const refName = first.get('refName')
    let start = Infinity
    let end = -Infinity
    for (const m of members) {
      start = Math.min(start, m.get('start'))
      end = Math.max(end, m.get('end'))
    }
    const data: Record<string, unknown> = { refName, start, end }
    for (const field of groupby) {
      data[field] = first.get(field)
    }
    for (const agg of ops) {
      data[aggregateFieldName(agg)] = aggregateValue(members, agg)
    }
    out.push(
      new SimpleFeature({
        uniqueId: `${refName}:${start}-${end}#${serial++}`,
        ...data,
      }),
    )
  }
  return out
}

function aggregateValue(
  members: readonly Feature[],
  { op, field }: AggregateOp,
) {
  if (op === 'count') {
    return members.length
  }
  if (field === undefined) {
    throw new Error(`an aggregate ${op} needs a field`)
  }
  let sum = 0
  let n = 0
  let min = Infinity
  let max = -Infinity
  for (const m of members) {
    const v = Number(m.get(field))
    if (!Number.isFinite(v)) {
      continue
    }
    sum += v
    n++
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  switch (op) {
    case 'sum': {
      return sum
    }
    case 'mean': {
      return n > 0 ? sum / n : undefined
    }
    case 'min': {
      return n > 0 ? min : undefined
    }
    case 'max': {
      return n > 0 ? max : undefined
    }
  }
}

/**
 * Piecewise-constant depth over the features' spans: one feature per run of
 * equal depth, where the depth is not zero. A sweep over the sorted edges,
 * so the input need not be sorted.
 */
function coverage(features: readonly Feature[], step: CoverageStep) {
  const as = step.as ?? DEFAULT_COVERAGE_AS
  const n = features.length
  if (n === 0) {
    return []
  }
  const starts = new Float64Array(n)
  const ends = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    starts[i] = features[i]!.get('start')
    ends[i] = features[i]!.get('end')
  }
  starts.sort()
  ends.sort()
  const refName = features[0]!.get('refName')
  const out: Feature[] = []
  let depth = 0
  let runStart = starts[0]!
  let si = 0
  let ei = 0
  const emit = (to: number) => {
    if (depth > 0 && to > runStart) {
      out.push(
        new SimpleFeature({
          uniqueId: `${refName}:${runStart}-${to}:${as}`,
          refName,
          start: runStart,
          end: to,
          [as]: depth,
        }),
      )
    }
  }
  while (si < n || ei < n) {
    const nextStart = si < n ? starts[si]! : Infinity
    const nextEnd = ei < n ? ends[ei]! : Infinity
    const at = Math.min(nextStart, nextEnd)
    emit(at)
    runStart = at
    while (si < n && starts[si] === at) {
      depth++
      si++
    }
    while (ei < n && ends[ei] === at) {
      depth--
      ei++
    }
  }
  return out
}

/**
 * #api
 * Run the transform steps over a feature list, in order, in the worker. The
 * list a step answers is what the next one reads, and the last one is what
 * the encoder walks.
 */
export function runTransforms(
  features: readonly Feature[],
  steps: readonly TransformStep[],
  jexl?: JexlInstance,
): readonly Feature[] {
  let current = features
  for (const step of steps) {
    switch (step.type) {
      case 'filter': {
        current = filter(current, step.expr, jexl)
        break
      }
      case 'formula': {
        current = formula(current, step.expr, step.as, jexl)
        break
      }
      case 'bin': {
        current = bin(current, step)
        break
      }
      case 'aggregate': {
        current = aggregate(current, step)
        break
      }
      case 'coverage': {
        current = coverage(current, step)
        break
      }
    }
  }
  return current
}
