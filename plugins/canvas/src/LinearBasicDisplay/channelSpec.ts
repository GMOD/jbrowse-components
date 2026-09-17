import {
  ensureJexlPrefix,
  isJexl,
  stringToJexlExpression,
} from '@jbrowse/core/util/jexlStrings'

import {
  STRAND_COLOR_JEXL,
  attributeColorJexl,
} from '../RenderFeatureDataRPC/featureColors.ts'

import type { FeatureGroupBy } from './groupBy.ts'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { ChannelSpec } from '@jbrowse/display-kit/channelSpec'

// Strand is the one field that is not a feature attribute: GFF3 gives it a
// column, so no attribute can take the name.
const STRAND = 'strand'

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
  const field = groupBy.type === 'strand' ? STRAND : groupBy.attribute
  return groupBy.domain?.length ? { field, domain: groupBy.domain } : { field }
}

// A facet with no domain writes an empty one, so a grouping re-picked in
// the same key space sorts instead of keeping the order it carried.
export function groupByOf(
  facet: NonNullable<ChannelSpec['facet']>,
): FeatureGroupBy {
  const domain = facet.domain ?? []
  return facet.field === STRAND
    ? { type: 'strand', domain }
    : { type: 'attribute', attribute: facet.field, domain }
}

export function colorOf(
  color: string | undefined,
  colorByAttribute: string,
): ChannelSpec['color'] {
  return color === undefined
    ? null
    : color === STRAND_COLOR_JEXL
      ? { field: STRAND }
      : colorByAttribute && color === attributeColorJexl(colorByAttribute)
        ? { field: colorByAttribute }
        : color
}

export function colorSlotOf(color: NonNullable<ChannelSpec['color']>) {
  return typeof color === 'string'
    ? color
    : color.field === STRAND
      ? STRAND_COLOR_JEXL
      : attributeColorJexl(color.field)
}

export function filterOf(activeFilters: string[]) {
  return activeFilters.length
    ? activeFilters.map(f => f.replace(/^jexl:/, ''))
    : null
}

function colorScaleProblems(color: ChannelSpec['color']) {
  return color && typeof color !== 'string' && (color.domain || color.palette)
    ? [
        color.field === STRAND
          ? "color: strand's colors are fixed, so it takes no domain or palette"
          : 'color: domain and palette are not taken on this track yet',
      ]
    : []
}

export function channelSpecProblems(spec: ChannelSpec, jexl: JexlInstance) {
  const expressions = [
    ...(spec.color
      ? [{ channel: 'color', code: colorSlotOf(spec.color) }]
      : []),
    ...(spec.filter ?? []).map(f => ({
      channel: 'filter',
      code: ensureJexlPrefix(f),
    })),
  ]
  return [
    ...colorScaleProblems(spec.color),
    ...expressions.flatMap(({ channel, code }) => {
      if (!isJexl(code)) {
        return []
      }
      try {
        stringToJexlExpression(code, jexl)
        return []
      } catch (e) {
        return [`${channel}: ${e}`]
      }
    }),
  ]
}
