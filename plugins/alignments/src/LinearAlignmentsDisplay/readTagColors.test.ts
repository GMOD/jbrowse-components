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

describe('categorical tag colors', () => {
  const build = (values: string[], map: Record<string, string>) =>
    buildReadTagColors(pileupWith(values), { type: 'tag', tag: 'HP' }, map)

  test('paints each value the color the map assigned', () => {
    expect([...build(['1', '2'], { '1': 'red', '2': 'blue' })]).toEqual([
      packed('red'),
      packed('blue'),
    ])
  })

  // "No color", so the shader and the Canvas2D twin both fall back to
  // colorPairLR — the same neutral an uncolored read paints, and (unlike the
  // fixed colorNostrand this used to pack) one that darkens with the theme
  // instead of leaving untagged reads brighter than their neighbours.
  test('a read the tag is absent from packs the palette fallback, not a strand color', () => {
    expect([...build([''], { '1': 'red' })]).toEqual([0])
    expect([...build(['3'], { '1': 'red' })]).toEqual([0])
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
