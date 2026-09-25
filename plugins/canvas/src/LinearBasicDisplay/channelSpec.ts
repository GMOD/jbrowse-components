import {
  ensureJexlPrefix,
  isJexl,
  stringToJexlExpression,
} from '@jbrowse/core/util/jexlStrings'
import { isIdentityColor } from '@jbrowse/display-kit/channelSpec'

import type { FeatureFacet } from './facet.ts'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { ChannelSpec } from '@jbrowse/display-kit/channelSpec'

export const CHANNEL_SPEC_EXAMPLES = [
  { spec: '{ "facet": "strand" }', description: 'one section per strand' },
  {
    spec: '{ "facet": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"] } }',
    description: 'a section per biotype, these two first',
  },
  {
    spec: '{ "color": { "field": "source" } }',
    description: 'one color per source',
  },
  {
    spec: '{ "color": { "field": "strand" } }',
    description: 'forward strand red, reverse blue',
  },
  {
    spec: '{ "color": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"], "range": ["#1f77b4", "#ff7f0e"] } }',
    description:
      'those two biotypes blue and orange, and every other its own color',
  },
  { spec: '{ "color": "#1f77b4" }', description: 'one color for everything' },
  {
    spec: '{ "filter": ["feature.type == \'gene\'"] }',
    description: 'genes only',
  },
  {
    spec: '{ "facet": null, "color": null }',
    description: 'ungrouped, default color',
  },
]

// The two objects as "Edit as JSON..." shows them: the string form for a
// constant color, and no key for an empty list.
export function facetOf(facet: FeatureFacet | undefined): ChannelSpec['facet'] {
  return facet
    ? {
        field: facet.field,
        ...(facet.domain.length ? { domain: [...facet.domain] } : {}),
      }
    : null
}

export function filterOf(activeFilters: string[]) {
  return activeFilters.length
    ? activeFilters.map(f => f.replace(/^jexl:/, ''))
    : null
}

export function channelSpecProblems(spec: ChannelSpec, jexl: JexlInstance) {
  const expressions = [
    ...(spec.color
      ? [
          {
            channel: 'color',
            code:
              typeof spec.color === 'string'
                ? spec.color
                : isIdentityColor(spec.color)
                  ? (spec.color.value ?? '')
                  : spec.color.field,
          },
        ]
      : []),
    ...(spec.filter ?? []).map(f => ({
      channel: 'filter',
      code: ensureJexlPrefix(f),
    })),
  ]
  return expressions.flatMap(({ channel, code }) => {
    if (!isJexl(code)) {
      return []
    }
    try {
      stringToJexlExpression(code, jexl)
      return []
    } catch (e) {
      return [`${channel}: ${e}`]
    }
  })
}
