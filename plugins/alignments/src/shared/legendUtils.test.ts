import { createJBrowseTheme } from '@jbrowse/core/ui/theme'

import { fillColor } from './color.ts'
import {
  getPileupLegendItems,
  getReadDisplayLegendItems,
  getSNPCoverageLegendItems,
} from './legendUtils.ts'

const theme = createJBrowseTheme()

describe('getPileupLegendItems', () => {
  test('returns strand items for strand colorBy', () => {
    const items = getPileupLegendItems({ type: 'strand' }, theme)
    expect(items).toHaveLength(3)
    expect(items[0]!.label).toBe('Forward strand')
    expect(items[1]!.label).toBe('Reverse strand')
    expect(items[2]!.label).toBe('Supplementary/split')
  })

  test('returns stranded items', () => {
    const items = getPileupLegendItems({ type: 'stranded' }, theme)
    expect(items).toHaveLength(3)
    expect(items[0]!.label).toContain('First-of-pair')
  })

  test('returns insert size items', () => {
    const items = getPileupLegendItems({ type: 'insertSize' }, theme)
    expect(items.some(i => i.label === 'Long insert')).toBe(true)
    expect(items.some(i => i.label === 'Normal')).toBe(true)
  })

  test('returns pair orientation items', () => {
    const items = getPileupLegendItems({ type: 'pairOrientation' }, theme)
    expect(items.some(i => i.label === 'Normal pair orientation')).toBe(true)
  })

  test('returns insertSize and orientation items', () => {
    const items = getPileupLegendItems(
      { type: 'insertSizeAndPairOrientation' },
      theme,
    )
    expect(items.some(i => i.label === 'Long insert')).toBe(true)
    expect(items.some(i => i.label === 'Normal pair orientation')).toBe(true)
  })

  test('returns mapping quality gradient items', () => {
    const items = getPileupLegendItems({ type: 'mappingQuality' }, theme)
    expect(items).toHaveLength(3)
    expect(items[0]!.label).toBe('MAPQ 0')
    expect(items[0]!.color).toBe('hsl(0, 50%, 50%)')
    expect(items[1]!.label).toBe('MAPQ 30')
    expect(items[1]!.color).toBe('hsl(30, 50%, 50%)')
    expect(items[2]!.label).toBe('MAPQ 60')
    expect(items[2]!.color).toBe('hsl(60, 50%, 50%)')
  })

  test('returns base items for default/unknown colorBy', () => {
    const items = getPileupLegendItems({ type: 'normal' }, theme)
    expect(items.some(i => i.label === 'A')).toBe(true)
    expect(items.some(i => i.label === 'Insertion')).toBe(true)
  })

  test('returns base items when colorBy is undefined', () => {
    const items = getPileupLegendItems(undefined, theme)
    expect(items.some(i => i.label === 'A')).toBe(true)
  })
})

describe('getReadDisplayLegendItems', () => {
  test('returns insertSizeAndOrientation items', () => {
    const items = getReadDisplayLegendItems({
      type: 'insertSizeAndOrientation',
    })
    expect(items.some(i => i.label === 'Long insert')).toBe(true)
    expect(items.some(i => i.label === 'Normal pair orientation')).toBe(true)
  })

  test('returns insertSize items', () => {
    const items = getReadDisplayLegendItems({ type: 'insertSize' })
    expect(items.some(i => i.label === 'Long insert')).toBe(true)
  })

  test('returns orientation items', () => {
    const items = getReadDisplayLegendItems({ type: 'orientation' })
    expect(items.some(i => i.label === 'Normal pair orientation')).toBe(true)
  })

  test('returns supplementary item for default', () => {
    const items = getReadDisplayLegendItems({ type: 'normal' })
    expect(items).toHaveLength(1)
    expect(items[0]!.label).toBe('Supplementary/split')
  })

  test('returns modification items when provided', () => {
    const mods = new Map([
      ['5mC', { type: '5mC', base: 'C', strand: '+', color: 'red' }],
    ])
    const items = getReadDisplayLegendItems({ type: 'modifications' }, mods)
    expect(items.some(i => i.label === '5mC')).toBe(true)
    expect(items.some(i => i.label === 'Supplementary/split')).toBe(true)
  })
})

describe('getSNPCoverageLegendItems', () => {
  const emptyMods = new Map<
    string,
    { type: string; base: string; strand: string; color: string }
  >()

  test('returns methylation items', () => {
    const items = getSNPCoverageLegendItems(
      { type: 'methylation' },
      emptyMods,
      theme,
    )
    expect(items).toHaveLength(2)
    expect(items[0]!.label).toBe('CpG methylated')
  })

  test('returns base items for default', () => {
    const items = getSNPCoverageLegendItems(
      { type: 'normal' },
      emptyMods,
      theme,
    )
    expect(items.some(i => i.label === 'A')).toBe(true)
  })
})
