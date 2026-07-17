import { getQueryColor } from '@jbrowse/core/ui/colors'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { buildReadTagColors, overlayReadTagColors } from './readTagColors.ts'
import { makeEmptyPileupData } from './testUtils.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'

function pileupWith(readTagValues: string[]): PileupDataResult {
  return {
    ...makeEmptyPileupData(),
    readTagValues,
    readStrands: new Int8Array(readTagValues.length).fill(1),
  }
}

const packed = (color: string) => {
  const [r, g, b] = cssColorToRgb(color)
  return packAbgr(r, g, b, 255)
}

describe('mateRefName (chromosome painting) colors', () => {
  const build = (names: string[]) =>
    buildReadTagColors(pileupWith(names), { type: 'mateRefName' }, {})

  test('hashes each mate refName to its category10 color', () => {
    expect([...build(['chr1', 'chr2'])]).toEqual([
      packed(getQueryColor('chr1')),
      packed(getQueryColor('chr2')),
    ])
  })

  test('the same refName always paints the same color', () => {
    const out = build(['chr1', 'chr7', 'chr1'])
    expect(out[0]).toBe(out[2])
    expect(out[0]).not.toBe(out[1])
  })

  test('a feature with no mate falls back to the palette rather than hashing an empty name', () => {
    expect([...build([''])]).toEqual([0])
    expect(packed(getQueryColor(''))).not.toBe(0)
  })

  test('every read is colored', () => {
    expect(build(['chr1', 'chr2', 'chr3'])).toHaveLength(3)
  })
})

describe('overlayReadTagColors', () => {
  const overlay = (colorBy: Parameters<typeof overlayReadTagColors>[1]) =>
    overlayReadTagColors(new Map([[0, pileupWith(['chr1'])]]), colorBy, {}).get(
      0,
    )!.readTagColors.length

  test('bakes colors for mateRefName', () => {
    expect(overlay({ type: 'mateRefName' })).toBe(1)
  })

  test('bakes colors for a tag scheme with a tag', () => {
    expect(overlay({ type: 'tag', tag: 'HP' })).toBe(1)
  })

  // The worker only fills readTagValues for the baked schemes, so any other
  // scheme must pass through untouched and leave the shader on its palette path.
  test('is a no-op for schemes the shader colors itself', () => {
    expect(overlay({ type: 'strand' })).toBe(0)
    expect(overlay({ type: 'tag' })).toBe(0)
    expect(overlay(undefined)).toBe(0)
  })
})
