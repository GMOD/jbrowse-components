import { isReadLevelScheme } from '../shared/readFieldLevels.ts'
import { readLevelValues } from '../shared/readLevels.ts'
import { collectAcrossGroups } from './groupLayout.ts'
import { presentMapqs } from './qualitySpans.ts'

import type { ColorBy } from '../shared/types.ts'
import type { ColoredByGroup } from './groupLayout.ts'

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
      ? collectAcrossGroups(byGroup, d => readLevelValues(type, d))
      : collectAcrossGroups(byGroup, d => d.readTagValues)
}
