import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { MAX_GROUPS } from '@jbrowse/core/util/groupKeys'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import type { GroupByCandidate } from '../../RenderFeatureDataRPC/groupByCandidates.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

export type GroupByScan = GroupByCandidate[] | RegionTooLargeResult

export interface AttributeGroupingVerdict {
  color: 'warning.main' | 'text.secondary'
  text: string
}

/**
 * The caption under the attribute box: what grouping by `field` would
 * section the features in view into. Never a refusal, since the cap folds
 * the tail rather than failing, but said before the fetch rather than read
 * off the chips after it.
 */
export function attributeGroupingVerdict(
  field: string,
  scan: GroupByScan | undefined,
): AttributeGroupingVerdict | undefined {
  if (field === '' || scan === undefined || isJexl(field)) {
    return undefined
  }
  if (isRegionRefused(scan)) {
    return {
      color: 'warning.main',
      text:
        'This region is too large to scan for attribute values, the same ' +
        'limit the track itself refuses at. Grouping still applies; zoom in ' +
        'to see how many sections it makes.',
    }
  }
  const candidate = scan.find(c => c.field === field)
  if (!candidate) {
    return {
      color: 'warning.main',
      text:
        `No feature in view carries ${field}. Grouping by it draws a single ` +
        `"${field}: none" section holding every feature, until you navigate ` +
        'somewhere it is set.',
    }
  }
  if (candidate.overflow) {
    return {
      color: 'warning.main',
      text:
        `${field} takes more than ${MAX_GROUPS} distinct values here, so the ` +
        'values sorting last merge into one section. Color by it instead, or ' +
        'group by an attribute with fewer values.',
    }
  }
  return {
    color: 'text.secondary',
    text: `Found values: ${candidate.values.join(', ')}${
      candidate.missing ? `, plus features with no ${field}` : ''
    }`,
  }
}

// The aside on an option in the attribute list.
export function sectionCountHint({
  values,
  missing,
  overflow,
}: GroupByCandidate) {
  if (overflow) {
    return `${MAX_GROUPS}+ sections`
  }
  const n = values.length + (missing ? 1 : 0)
  return n === 1 ? '1 section' : `${n} sections`
}
