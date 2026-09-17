import { OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
import {
  ensureJexlPrefix,
  isJexl,
  stringToJexlExpression,
} from '@jbrowse/core/util/jexlStrings'

import {
  STRAND_COLOR_JEXL,
  attributeColorJexl,
  attributeColorOf,
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
  {
    spec: '{ "color": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"], "palette": ["#1f77b4", "#ff7f0e"] } }',
    description: 'those two biotypes blue and orange, and a key saying so',
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

export function colorOf(color: string | undefined): ChannelSpec['color'] {
  if (color === undefined) {
    return null
  }
  if (color === STRAND_COLOR_JEXL) {
    return { field: STRAND }
  }
  const byField = attributeColorOf(color)
  return byField
    ? {
        field: byField.attribute,
        ...(byField.domain.length ? { domain: byField.domain } : {}),
        ...(byField.palette.length ? { palette: byField.palette } : {}),
      }
    : color
}

export function colorSlotOf(color: NonNullable<ChannelSpec['color']>) {
  return typeof color === 'string'
    ? color
    : color.field === STRAND
      ? STRAND_COLOR_JEXL
      : attributeColorJexl(color.field, color.domain, color.palette)
}

/**
 * A color by the facet's own field that names no domain takes the facet's,
 * so the sections and their colors list in one order. Copied when the spec is
 * applied rather than read at paint time, so a later Sections move reorders
 * the sections and leaves the colors where they are. The catch-all and
 * overflow sections name no value, so they spend no color.
 */
export function withFacetDomain(
  spec: ChannelSpec,
  facet: ChannelSpec['facet'],
): ChannelSpec {
  const { color } = spec
  return color &&
    typeof color !== 'string' &&
    color.field !== STRAND &&
    !color.domain &&
    facet?.domain &&
    facet.field === color.field
    ? {
        ...spec,
        color: {
          ...color,
          domain: facet.domain.filter(
            key => key !== '' && key !== OVERFLOW_GROUP_KEY,
          ),
        },
      }
    : spec
}

export function filterOf(activeFilters: string[]) {
  return activeFilters.length
    ? activeFilters.map(f => f.replace(/^jexl:/, ''))
    : null
}

function colorScaleProblems(color: ChannelSpec['color']) {
  return color &&
    typeof color !== 'string' &&
    color.field === STRAND &&
    (color.domain || color.palette)
    ? ["color: strand's colors are fixed, so it takes no domain or palette"]
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
