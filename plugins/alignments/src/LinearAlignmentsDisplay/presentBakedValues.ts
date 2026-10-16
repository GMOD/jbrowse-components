import { isReadLevelScheme } from '../shared/readFieldLevels.ts'
import { addPresentReadLevels } from '../shared/readLevels.ts'
import { collectAcrossGroups } from './groupLayout.ts'
import { presentMapqs } from './qualitySpans.ts'

import type { ColorBy } from '../shared/types.ts'
import type { ColoredByGroup } from './groupLayout.ts'

function presentLevels(
  scheme: Parameters<typeof addPresentReadLevels>[0],
  byGroup: ColoredByGroup,
) {
  const present = new Set<string>()
  for (const map of byGroup.values()) {
    for (const data of map.values()) {
      addPresentReadLevels(scheme, data, present)
    }
  }
  return present
}

/**
 * The values a baked scheme paints on the laid-out reads, as its key lists
 * them: MAPQ scores, a read-level field's levels, or the tag and mate values
 * the worker shipped.
 */
export function presentBakedValues(colorBy: ColorBy, byGroup: ColoredByGroup) {
  const { type } = colorBy
  return type === 'mappingQuality'
    ? presentMapqs(byGroup)
    : isReadLevelScheme(type)
      ? presentLevels(type, byGroup)
      : collectAcrossGroups(byGroup, d => d.readTagValues)
}
