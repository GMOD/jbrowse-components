import { conditions } from '@jbrowse/jexl'

import { FEATURE_ROW, parseJexl } from './jexlSyntax.ts'
import { PROXY_NAMES } from './simpleFeature.ts'

import type { FieldPredicate } from './fieldPredicate.ts'
import type { Condition } from '@jbrowse/jexl'

/** The typed lane a field has: one number per row, or a label code per row. */
export type TypedLane = 'number' | 'labels'

const BOUND = { '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' } as const

function predicateOf(
  c: Condition,
  laneOf: (field: string) => TypedLane | undefined,
): FieldPredicate | undefined {
  const [field] = c.subject.kind === 'path' ? c.subject.path : []
  const lane =
    c.subject.kind === 'path' &&
    c.subject.path.length === 1 &&
    typeof field === 'string' &&
    !PROXY_NAMES.has(field)
      ? laneOf(field)
      : undefined
  if (!lane || typeof field !== 'string') {
    return undefined
  }
  const type = lane === 'number' ? 'number' : 'string'
  switch (c.op) {
    case '==': {
      return typeof c.value === type ? { field, equal: c.value! } : undefined
    }
    case 'in': {
      return c.value.every(v => typeof v === type)
        ? { field, oneOf: c.value as (string | number)[] }
        : undefined
    }
    case '<':
    case '<=':
    case '>':
    case '>=': {
      return lane === 'number' && typeof c.value === 'number'
        ? { field, [BOUND[c.op]]: c.value }
        : undefined
    }
    default: {
      return undefined
    }
  }
}

/**
 * A `jexl:` filter as field predicates, when each of its conditions tests
 * the same on a typed lane as jexl tests it on the row: a field with a
 * number lane compared with a number, or one with a label lane matched
 * against text, as in `feature.score >= 10 && feature.type == 'gene'`.
 * Anything else, such as `!=`, a pattern or a list field, answers undefined
 * and runs as written.
 */
export function expressionPredicates(
  expr: string,
  laneOf: (field: string) => TypedLane | undefined,
): FieldPredicate[] | undefined {
  const ast = parseJexl(expr)
  const list = ast && conditions(ast, FEATURE_ROW)
  const predicates = list?.map(c => predicateOf(c, laneOf))
  return predicates?.every(p => p !== undefined) ? predicates : undefined
}
