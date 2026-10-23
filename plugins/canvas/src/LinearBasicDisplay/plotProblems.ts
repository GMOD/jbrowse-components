import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { isJexl, stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

import type { FeatureFacet } from './facet.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/**
 * A facet as the plot writes it, its field alone while it lists no order and
 * hides no section.
 */
export function facetOf(
  facet: FeatureFacet | undefined,
  hidden: readonly string[] = [],
) {
  return facet
    ? {
        field: facet.field,
        ...(facet.sort.length ? { sort: [...facet.sort] } : {}),
        ...(hidden.length ? { hidden: [...hidden] } : {}),
      }
    : null
}

/** A plot's color channel as an object, its field shorthand unfolded. */
export function colorOf(color: unknown): ColorSlots {
  return typeof color === 'string'
    ? { field: color }
    : ((color as ColorSlots | undefined) ?? {})
}

function colorExpression(encoding: unknown) {
  const { color } = (encoding ?? {}) as { color?: unknown }
  const { field, value } = colorOf(color)
  return field ?? value
}

/** A draft's `jexl:` color or filter that does not compile, by setting. */
export function plotJexlProblems(draft: Plot, jexl: JexlInstance) {
  const expressions = [
    { setting: 'encoding.color', code: colorExpression(draft.encoding) },
    ...predicatesOf(draft.filter).map(p => ({
      setting: 'filter',
      code: p.field,
    })),
  ]
  return expressions.flatMap(({ setting, code }) => {
    if (!isJexl(code)) {
      return []
    }
    try {
      stringToJexlExpression(code, jexl)
      return []
    } catch (e) {
      return [`${setting}: ${e}`]
    }
  })
}
