import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

type Test = Exclude<keyof FieldPredicate, 'field'>

const TESTS: readonly Test[] = [
  'equal',
  'lt',
  'lte',
  'gt',
  'gte',
  'oneOf',
  'valid',
]

/** What a layer filter field takes: its tests, and the most a floor can be. */
export interface LayerFilterField {
  tests: readonly Test[]
  max?: number
}

/**
 * The entries of a layer's `filter` at `path` the layer cannot apply as
 * written: a field it has no reading of, a test the field does not take, or
 * a floor above the field's range.
 */
export function layerFilterProblems(
  path: string,
  filter: unknown,
  fields: Readonly<Record<string, LayerFilterField>>,
): string[] {
  return predicatesOf(filter).flatMap(p => {
    const field = Object.hasOwn(fields, p.field) ? fields[p.field] : undefined
    if (!field) {
      return [
        `${path}: no field ${JSON.stringify(p.field)}; it takes ${Object.keys(fields).join(', ')}`,
      ]
    }
    const { tests, max } = field
    const refused = TESTS.filter(t => p[t] !== undefined && !tests.includes(t))
    return [
      ...(refused.length > 0
        ? [
            `${path}: ${p.field} takes ${tests.join(' or ')}, not ${JSON.stringify(p)}`,
          ]
        : []),
      ...(max !== undefined &&
      [p.gt, p.gte].some(b => b !== undefined && (b < 0 || b > max))
        ? [
            `${path}: ${p.field} runs from 0 to ${max}, not ${JSON.stringify(p)}`,
          ]
        : []),
    ]
  })
}
