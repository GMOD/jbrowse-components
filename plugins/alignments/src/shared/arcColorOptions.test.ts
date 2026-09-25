import { colorFieldOf } from './alignmentsColor.ts'
import { ARC_COLOR_FIELDS, arcColorFieldOf } from './arcColorOptions.ts'

import type { ReadColorBy } from './types.ts'

const INHERITED: [ReadColorBy, string][] = [
  [{ type: 'insertSize' }, 'insertSize'],
  [{ type: 'pairOrientation' }, 'pairOrientation'],
  [{ type: 'insertSizeAndOrientation' }, 'insertSizeAndOrientation'],
  [{ type: 'normal' }, 'insertSizeAndOrientation'],
  [{ type: 'strand' }, 'insertSizeAndOrientation'],
  [{ type: 'firstOfPairStrand' }, 'insertSizeAndOrientation'],
  [{ type: 'mappingQuality' }, 'insertSizeAndOrientation'],
  [{ type: 'mateRefName' }, 'insertSizeAndOrientation'],
  [{ type: 'tag', tag: 'HP' }, 'insertSizeAndOrientation'],
  [{ type: 'tag', attribute: 'name' }, 'insertSizeAndOrientation'],
]

describe('arcColorFieldOf', () => {
  test.each(INHERITED)(
    'an empty arcColor under reads colored by %j paints %s',
    (colorBy, expected) => {
      expect(arcColorFieldOf('', colorFieldOf(colorBy))).toBe(expected)
    },
  )

  test.each(ARC_COLOR_FIELDS)('an arcColor of %s wins over the reads', own => {
    for (const [colorBy] of INHERITED) {
      expect(arcColorFieldOf(own, colorFieldOf(colorBy))).toBe(own)
    }
  })
})
