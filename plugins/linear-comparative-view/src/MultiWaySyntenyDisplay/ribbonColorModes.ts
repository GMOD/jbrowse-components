import type { Feature } from '@jbrowse/core/util'
import type {
  AttributeRange,
  ATTRIBUTE_PREFIX as SYNTENY_ATTRIBUTE_PREFIX,
} from '@jbrowse/synteny-core'

// A leaf module: the website's spec-recipe check imports it under plain node,
// so no value import may reach synteny-core's index and its .tsx. The prefix
// is pinned to the synteny view's by type, so the two cannot drift.
const ATTRIBUTE_PREFIX: typeof SYNTENY_ATTRIBUTE_PREFIX = 'attribute:'

/**
 * What colors a ribbon: a fixed mode, or `attribute:<column>` naming a column
 * the track declares in `attributeColumns`, the synteny view's own spelling.
 */
export type MultiWayRibbonColorBy =
  | 'default'
  | 'strand'
  | 'identity'
  | `${typeof ATTRIBUTE_PREFIX}${string}`

export const RIBBON_COLOR_MODES: readonly (readonly [
  MultiWayRibbonColorBy,
  string,
])[] = [
  ['default', 'Default'],
  ['strand', 'Strand'],
  ['identity', 'Identity'],
]

const fixedModes = new Set<string>(RIBBON_COLOR_MODES.map(([value]) => value))

export function coerceRibbonColorBy(value: string): MultiWayRibbonColorBy {
  return fixedModes.has(value) ||
    (value.startsWith(ATTRIBUTE_PREFIX) &&
      value.length > ATTRIBUTE_PREFIX.length)
    ? (value as MultiWayRibbonColorBy)
    : 'default'
}

/** The fixed modes, then one entry per column the track declares. */
export function ribbonColorModeOptions(
  attributes: readonly string[],
): readonly (readonly [MultiWayRibbonColorBy, string])[] {
  return [
    ...RIBBON_COLOR_MODES,
    ...attributes.map(
      attribute =>
        [
          `${ATTRIBUTE_PREFIX}${attribute}`,
          attribute,
        ] as const satisfies readonly [MultiWayRibbonColorBy, string],
    ),
  ]
}

/**
 * Per declared column, the labels these features carry as text in first-seen
 * order, with the `color` the file put beside a label the first time it had
 * one. The main-thread twin of the worker's attribute channels: this display
 * holds its features, so it reads them rather than shipping a lane.
 */
export function featureLabelTable(
  features: readonly Feature[],
  attributes: readonly string[],
) {
  const table: Record<string, AttributeRange> = {}
  for (const attribute of attributes) {
    const labels: string[] = []
    const seen = new Set<string>()
    const colors: Record<string, string> = {}
    for (const feature of features) {
      const value: unknown = feature.get(attribute)
      if (typeof value === 'string' && value !== '') {
        if (!seen.has(value)) {
          seen.add(value)
          labels.push(value)
        }
        const color: unknown = feature.get('color')
        if (
          typeof color === 'string' &&
          color !== '' &&
          colors[value] === undefined
        ) {
          colors[value] = color
        }
      }
    }
    if (labels.length > 0) {
      table[attribute] = { labels, colors }
    }
  }
  return table
}
