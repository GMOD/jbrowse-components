import { isJexl, stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

import type { FeatureFacet } from './facet.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/** A facet as the plot writes it, its field alone while it lists no order. */
export function facetOf(facet: FeatureFacet | undefined) {
  return facet
    ? {
        field: facet.field,
        ...(facet.domain.length ? { domain: [...facet.domain] } : {}),
      }
    : null
}

/** A plot's color as an object, its constant shorthand unfolded. */
export function colorOf(color: unknown): ColorSlots {
  return typeof color === 'string'
    ? { value: color }
    : ((color as ColorSlots | undefined) ?? {})
}

function colorExpression(color: unknown) {
  return typeof color === 'string'
    ? color
    : typeof color === 'object' && color !== null
      ? (((color as Record<string, unknown>).field ??
          (color as Record<string, unknown>).value) as string | undefined)
      : undefined
}

/** A draft's `jexl:` color or filter that does not compile, by setting. */
export function plotJexlProblems(draft: Plot, jexl: JexlInstance) {
  const filter = Array.isArray(draft.filter) ? (draft.filter as unknown[]) : []
  const expressions = [
    { setting: 'color', code: colorExpression(draft.color) },
    ...filter.map(code => ({ setting: 'filter', code })),
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
