import { ARC_COLOR_FIELDS, arcColorFieldOf } from './arcColorOptions.ts'

const INHERITED: [string, string][] = [
  ['insertSize', 'insertSize'],
  ['pairOrientation', 'pairOrientation'],
  ['insertSizeAndOrientation', 'insertSizeAndOrientation'],
  ['', 'insertSizeAndOrientation'],
  ['strand', 'insertSizeAndOrientation'],
  ['firstOfPairStrand', 'insertSizeAndOrientation'],
  ['mapq', 'insertSizeAndOrientation'],
  ['mateRefName', 'insertSizeAndOrientation'],
  ['tags.HP', 'insertSizeAndOrientation'],
  ['name', 'insertSizeAndOrientation'],
]

describe('arcColorFieldOf', () => {
  test.each(INHERITED)(
    'an empty arcColor under reads colored by %j paints %s',
    (colorField, expected) => {
      expect(arcColorFieldOf('', colorField)).toBe(expected)
    },
  )

  test.each(ARC_COLOR_FIELDS)('an arcColor of %s wins over the reads', own => {
    for (const [colorField] of INHERITED) {
      expect(arcColorFieldOf(own, colorField)).toBe(own)
    }
  })
})
