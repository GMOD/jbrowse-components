import { isJexl, stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

import type { FeatureFacet } from './facet.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export const PLOT_EXAMPLES = [
  { plot: '{ "facet": "strand" }', description: 'one section per strand' },
  {
    plot: '{ "facet": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"] } }',
    description: 'a section per biotype, these two first',
  },
  {
    plot: '{ "color": { "field": "source" } }',
    description: 'one color per source',
  },
  {
    plot: '{ "color": { "field": "strand" } }',
    description: 'forward strand red, reverse blue',
  },
  {
    plot: '{ "color": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"], "range": ["#1f77b4", "#ff7f0e"] } }',
    description:
      'those two biotypes blue and orange, and every other its own color',
  },
  { plot: '{ "color": "#1f77b4" }', description: 'one color for everything' },
  {
    plot: '{ "filter": ["jexl:feature.type == \'gene\'"] }',
    description: 'genes only',
  },
  {
    plot: '{ "facet": null, "color": null }',
    description: 'ungrouped, default color',
  },
]

/** A facet as the plot writes it, its field alone while it lists no order. */
export function facetOf(facet: FeatureFacet | undefined) {
  return facet
    ? {
        field: facet.field,
        ...(facet.domain.length ? { domain: [...facet.domain] } : {}),
      }
    : null
}

function colorExpression(color: unknown) {
  return typeof color === 'string'
    ? color
    : typeof color === 'object' && color !== null
      ? (((color as Record<string, unknown>).field ??
          (color as Record<string, unknown>).value) as string | undefined)
      : undefined
}

/** A draft's `jexl:` colour or filter that does not compile, by setting. */
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
