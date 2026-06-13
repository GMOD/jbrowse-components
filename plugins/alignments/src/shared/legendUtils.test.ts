import { getReadDisplayLegendItems } from './legendUtils.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'

import type { ColorSchemeType, ModificationTypeWithColor } from './types.ts'
import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'

function labels(
  type: ColorSchemeType,
  categories: ReadColorCategory[],
  visibleModifications?: Map<string, ModificationTypeWithColor>,
) {
  return getReadDisplayLegendItems(
    { type },
    new Set(categories),
    makeTestPalette(),
    visibleModifications,
  ).map(i => i.label)
}

describe('getReadDisplayLegendItems', () => {
  test('lists only the buckets present in the reads', () => {
    expect(labels('insertSize', ['normalInsert'])).toEqual(['Normal'])
    expect(labels('insertSize', ['normalInsert', 'longInsert'])).toEqual([
      'Normal',
      'Long insert',
    ])
  })

  test('omits "Supplementary/split" when no supplementary reads are present', () => {
    expect(labels('insertSize', ['normalInsert'])).not.toContain(
      'Supplementary/split',
    )
    expect(labels('strand', ['fwdStrand'])).toEqual(['Forward strand'])
  })

  test('includes "Supplementary/split" only when that bucket occurs', () => {
    expect(labels('insertSize', ['normalInsert', 'supplementary'])).toContain(
      'Supplementary/split',
    )
    expect(labels('strand', ['fwdStrand', 'supplementary'])).toEqual([
      'Forward strand',
      'Supplementary/split',
    ])
  })

  test('pair orientation lists only the orientations seen', () => {
    expect(labels('pairOrientation', ['pairLR', 'pairRL'])).toEqual([
      'LR - Normal pair orientation',
      'RL - Mates point outward',
    ])
  })

  test('normal scheme with no cross-cutting buckets has an empty legend', () => {
    expect(labels('normal', ['plain'])).toEqual([])
    // chain mode can still surface unmapped/supplementary
    expect(labels('normal', ['plain', 'unmappedMate'])).toEqual([
      'Unmapped mate',
    ])
  })

  test('mapping quality is a fixed ramp regardless of present buckets', () => {
    expect(labels('mappingQuality', [])).toEqual([
      'MAPQ 0',
      'MAPQ 30',
      'MAPQ ≥60',
    ])
  })

  test('modifications list visible mod types, gating supplementary on presence', () => {
    const mods = new Map([
      ['m', { color: 'red', type: 'm', base: 'C', strand: '+' }],
      ['h', { color: 'blue', type: 'h', base: 'C', strand: '+' }],
    ])
    expect(labels('modifications', [], mods)).toEqual(['m', 'h'])
    expect(labels('modifications', ['supplementary'], mods)).toEqual([
      'm',
      'h',
      'Supplementary/split',
    ])
  })

  test('swatch colors come from the live palette when provided', () => {
    const palette = makeTestPalette({
      colorFwdStrand: [0, 0, 1],
      colorSupplementary: [0, 1, 0],
    })
    const items = getReadDisplayLegendItems(
      { type: 'strand' },
      new Set<ReadColorCategory>(['fwdStrand', 'supplementary']),
      palette,
    )
    expect(items).toEqual([
      { color: 'rgb(0,0,255)', label: 'Forward strand' },
      { color: 'rgb(0,255,0)', label: 'Supplementary/split' },
    ])
  })
})
