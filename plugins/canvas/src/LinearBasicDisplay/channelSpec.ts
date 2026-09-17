import {
  ensureJexlPrefix,
  isJexl,
  stringToJexlExpression,
} from '@jbrowse/core/util/jexlStrings'

import { STRAND_FIELD } from '../RenderFeatureDataRPC/featureColors.ts'

import type { ColorScaleSettings } from '../RenderFeatureDataRPC/featureColors.ts'
import type { FeatureGroupBy } from './groupBy.ts'
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
    spec: '{ "color": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"], "palette": ["#1f77b4", "#ff7f0e"] } }',
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

export function facetOf(groupBy: FeatureGroupBy | undefined) {
  if (groupBy === undefined) {
    return null
  }
  const field = groupBy.type === 'strand' ? STRAND_FIELD : groupBy.attribute
  return groupBy.domain?.length ? { field, domain: groupBy.domain } : { field }
}

// A facet with no domain writes an empty one, so a grouping re-picked in
// the same key space sorts instead of keeping the order it carried.
export function groupByOf(
  facet: NonNullable<ChannelSpec['facet']>,
): FeatureGroupBy {
  const domain = facet.domain ?? []
  return facet.field === STRAND_FIELD
    ? { type: 'strand', domain }
    : { type: 'attribute', attribute: facet.field, domain }
}

export function colorOf({
  color,
  colorField,
  colorDomain,
  colorPalette,
}: ColorScaleSettings & { color: string | undefined }): ChannelSpec['color'] {
  return colorField
    ? {
        field: colorField,
        ...(colorDomain.length ? { domain: [...colorDomain] } : {}),
        ...(colorPalette.length ? { palette: [...colorPalette] } : {}),
      }
    : (color ?? null)
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
              typeof spec.color === 'string' ? spec.color : spec.color.field,
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
