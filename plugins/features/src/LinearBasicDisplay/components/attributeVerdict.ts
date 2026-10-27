import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { pluralize } from '@jbrowse/core/util'
import { MAX_GROUPS } from '@jbrowse/core/util/groupKeys'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import type { GroupByCandidate } from '../../RenderFeatureDataRPC/groupByCandidates.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

export type AttributeScan = GroupByCandidate[] | RegionTooLargeResult

// The cap is on the caption, not on the grouping: a GFF3 `Note` runs to
// sentences, and 40 of them under the box resize the dialog around the user.
const CAPTION_VALUES = 8

export interface AttributeVerdict {
  color: 'warning.main' | 'text.secondary'
  text: string
}

/**
 * What an attribute is picked for, in the words the picker says it with: each
 * of its values becomes one `unit`.
 */
export interface AttributeUse {
  unit: string
  refused: string
  absent: (field: string) => string
  overflow: string
}

export const GROUPING: AttributeUse = {
  unit: 'section',
  refused: 'Grouping still applies; zoom in to see how many sections it makes.',
  absent: field =>
    `Grouping by it draws a single "${field}: none" section holding every feature, until you navigate somewhere it is set.`,
  overflow:
    'so the values sorting last merge into one section. Color by it instead, or group by an attribute with fewer values.',
}

export const COLORING: AttributeUse = {
  unit: 'color',
  refused: 'Coloring still applies; zoom in to see how many colors it paints.',
  absent: () =>
    'Coloring by it paints every feature in the no-value color, until you navigate somewhere it is set.',
  overflow: 'more than the color key lists.',
}

/**
 * The caption under the attribute box: what picking `field` would make of the
 * features in view, said before the fetch rather than read off the track after
 * it.
 */
export function attributeVerdict(
  field: string,
  scan: AttributeScan | undefined,
  use: AttributeUse,
): AttributeVerdict | undefined {
  if (scan === undefined) {
    return undefined
  }
  // Above the field guards, because a refusal is a fact about the REGION and
  // not about what the user has typed: the options list is empty either way,
  // and with nothing typed yet an empty list with no caption reads as "this
  // track carries no attributes" rather than "zoom in and I can tell you".
  if (isRegionRefused(scan)) {
    return {
      color: 'warning.main',
      text: `This region is too large to scan for attribute values, the same limit the track itself refuses at. ${use.refused}`,
    }
  }
  if (field === '' || isJexl(field)) {
    return undefined
  }
  const candidate = scan.find(c => c.field === field)
  if (!candidate) {
    return {
      color: 'warning.main',
      text: `No feature in view carries ${field}. ${use.absent(field)}`,
    }
  }
  if (candidate.overflow) {
    return {
      color: 'warning.main',
      text: `${field} takes more than ${MAX_GROUPS} distinct values here, ${use.overflow}`,
    }
  }
  const shown = candidate.values.slice(0, CAPTION_VALUES)
  const rest = candidate.values.length - shown.length
  return {
    color: 'text.secondary',
    text: `Found ${
      rest > 0 ? `${candidate.values.length} values` : 'values'
    }: ${shown.join(', ')}${rest > 0 ? `, and ${rest} more` : ''}${
      candidate.missing ? `, plus features with no ${field}` : ''
    }`,
  }
}

// The aside on an option in the attribute list.
export function candidateCountHint(
  { values, missing, overflow }: GroupByCandidate,
  use: AttributeUse,
) {
  if (overflow) {
    return `${MAX_GROUPS}+ ${use.unit}s`
  }
  const n = values.length + (missing ? 1 : 0)
  return `${n} ${pluralize(n, use.unit)}`
}
