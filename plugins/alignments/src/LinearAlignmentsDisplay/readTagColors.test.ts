import { getQueryColor } from '@jbrowse/core/ui/colors'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { bakedValueColor } from './colorTagUtils.ts'
import { buildReadTagColors, overlayReadTagColors } from './readTagColors.ts'

import type { ColorBy } from '../shared/types.ts'

const TAG: ColorBy = { type: 'tag', tag: 'HP' }

// Laid out, because that is what the overlay takes: the tag bake runs after
// placement and spreads over its result.
function pileupWith(readTagValues: string[]) {
  return makePileupDataResult({
    readTagValues,
    readStrands: new Int8Array(readTagValues.length).fill(1),
  })
}

const packed = (color: string) => {
  const [r, g, b] = cssColorToRgb(color)
  return packAbgr(r, g, b, 255)
}

describe('mateRefName (chromosome painting) colors', () => {
  const build = (names: string[]) =>
    buildReadTagColors(pileupWith(names), { type: 'mateRefName' })

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

describe('categorical tag colors', () => {
  const build = (values: string[]) =>
    buildReadTagColors(pileupWith(values), { type: 'tag', tag: 'HP' })

  // The color comes from the value itself (`bakedValueColor`), so a read paints
  // the moment its value is known rather than once some earlier fetch had
  // discovered it into a table.
  test('paints each value the color its own value resolves', () => {
    expect([...build(['1', '2'])]).toEqual([
      packed(bakedValueColor(TAG, '1')),
      packed(bakedValueColor(TAG, '2')),
    ])
  })

  // Nothing has to have seen the value before. Under the discovered-value map
  // this packed 0 and the read painted the neutral fallback until the fetch
  // that found it had assigned a color.
  test('a value no earlier fetch saw still paints', () => {
    expect([...build(['3'])]).toEqual([packed(bakedValueColor(TAG, '3'))])
  })

  // "No color", so the shader and the Canvas2D twin both fall back to
  // colorPairLR — the same neutral an uncolored read paints, and (unlike the
  // fixed colorNeutralRead this used to pack) one that darkens with the theme
  // instead of leaving untagged reads brighter than their neighbours.
  test('a read the tag is absent from packs the palette fallback, not a strand color', () => {
    expect([...build([''])]).toEqual([0])
  })
})

describe('overlayReadTagColors', () => {
  const overlay = (colorBy: Parameters<typeof overlayReadTagColors>[1]) =>
    overlayReadTagColors(new Map([[0, pileupWith(['chr1'])]]), colorBy).get(0)!
      .readTagColors.length

  test('bakes colors for mateRefName', () => {
    expect(overlay({ type: 'mateRefName' })).toBe(1)
  })

  test('bakes colors for a tag scheme with a tag', () => {
    expect(overlay({ type: 'tag', tag: 'HP' })).toBe(1)
  })

  // The worker only fills readTagValues for the baked schemes, so any other
  // scheme must leave the array empty and the shader on its palette path.
  test('bakes nothing for schemes the shader colors itself', () => {
    expect(overlay({ type: 'strand' })).toBe(0)
    expect(overlay({ type: 'tag' })).toBe(0)
    expect(overlay(undefined)).toBe(0)
  })
})
