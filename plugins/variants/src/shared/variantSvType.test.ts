import { SimpleFeature } from '@jbrowse/core/util'

import { ALT_HUE } from './cellFill.ts'
import {
  NON_SV_TYPE,
  PREDEFINED_SV_TYPES,
  assignSvTypeColors,
  getVariantSvTypeColor,
  svTypeDisplayLabel,
  svTypeLegendEntries,
} from './variantSvType.ts'

function feat(data: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: 'x',
    refName: 'ctgA',
    start: 0,
    end: 1,
    ...data,
  })
}

describe('getVariantSvTypeColor (single-variant fixed-color jexl)', () => {
  it('returns the class color', () => {
    expect(getVariantSvTypeColor(feat({ ALT: ['<DEL>'] }))).toBe('#e41a1c')
    // 1000 Genomes' <CN0> is a deletion, and paints as one
    expect(getVariantSvTypeColor(feat({ ALT: ['<CN0>'] }))).toBe('#e41a1c')
  })
  it('paints a token no class names the one other color', () => {
    const other = getVariantSvTypeColor(feat({ ALT: ['<WEIRD>'] }))
    expect(getVariantSvTypeColor(feat({ ALT: ['<DUP/INS>'] }))).toBe(other)
    expect(other).toBe(PREDEFINED_SV_TYPES.find(t => t.type === 'OTHER')!.color)
  })
  it('returns grey for a record with no structural class', () => {
    expect(getVariantSvTypeColor(feat({ ALT: ['A'] }))).toBe('#808080')
  })
})

describe('svTypeLegendEntries', () => {
  it('names every color the painter hands out', () => {
    const colors = svTypeLegendEntries().map(e => e.color)
    for (const alt of ['<DEL>', '<CNV:TR>', '<INVDUP>', '<WEIRD>', 'A']) {
      expect(colors).toContain(getVariantSvTypeColor(feat({ ALT: [alt] })))
    }
  })

  it('names the grey a record with no class paints, last', () => {
    const rows = svTypeLegendEntries()
    expect(rows.at(-1)).toMatchObject({
      color: getVariantSvTypeColor(feat({ ALT: ['A'] })),
      label: NON_SV_TYPE,
      missing: true,
    })
  })
})

describe('assignSvTypeColors', () => {
  it('assigns the class colors in key order', () => {
    const colors = assignSvTypeColors(['OTHER', 'DUP', 'DEL'])
    expect(Object.keys(colors)).toEqual(['DEL', 'DUP', 'OTHER'])
    expect(colors.DEL).toBe('#e41a1c')
    expect(colors.DUP).toBe('#377eb8')
  })

  it('gives each class one color whatever else is present', () => {
    expect(assignSvTypeColors(['TR']).TR).toBe(
      assignSvTypeColors(['DEL', 'TR', 'CPX']).TR,
    )
  })

  it('is empty for no types', () => {
    expect(assignSvTypeColors([])).toEqual({})
  })

  it('paints the non-structural member the default alt hue, last', () => {
    const colors = assignSvTypeColors([NON_SV_TYPE, 'DEL'])
    expect(colors[NON_SV_TYPE]).toBe(ALT_HUE)
    expect(Object.keys(colors).at(-1)).toBe(NON_SV_TYPE)
  })
})

describe('svTypeDisplayLabel', () => {
  it('labels each class', () => {
    expect(svTypeDisplayLabel('DEL')).toBe('Deletion')
    expect(svTypeDisplayLabel('TR')).toBe('Tandem repeat')
    expect(svTypeDisplayLabel('OTHER')).toBe('Other / mixed')
  })
})
