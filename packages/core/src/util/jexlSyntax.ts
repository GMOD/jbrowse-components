import { Jexl } from '@jbrowse/jexl'

import { stripJexlPrefix } from './jexlStrings.ts'

/**
 * How a JBrowse expression reads a feature, for jexl's `analyze`, `check` and
 * `conditions`: the row is `feature`, and `get(feature, 'x')` reads its `x`.
 */
export const FEATURE_ROW = { row: 'feature', accessors: { get: [] } } as const

const parser = new Jexl()

/**
 * The tree of an expression, written with or without its `jexl:` prefix, or
 * undefined where it is empty or does not parse with jexl's own operators.
 */
export function parseJexl(text: string) {
  const code = text.trim()
  try {
    return parser.parse(stripJexlPrefix(code)) ?? undefined
  } catch {
    return undefined
  }
}
