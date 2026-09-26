import { set1 } from '@jbrowse/core/ui/colors'
import { SimpleFeature } from '@jbrowse/core/util'

import { ALT_HUE } from './cellFill.ts'
import {
  NON_SV_TYPE,
  assignSvTypeColors,
  getVariantSvType,
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

describe('getVariantSvType', () => {
  it('derives the class from a symbolic/breakend ALT, normalizing tokens', () => {
    expect(getVariantSvType(feat({ ALT: ['<DEL>'] }))).toBe('DEL')
    expect(getVariantSvType(feat({ ALT: ['<TRA>'] }))).toBe('BND') // TRA -> BND
    expect(getVariantSvType(feat({ ALT: ['<DUP:TANDEM>'] }))).toBe('DUP') // strip :sub
    expect(getVariantSvType(feat({ ALT: ['G[ctgA:200['] }))).toBe('BND') // breakend
    expect(getVariantSvType(feat({ ALT: ['<INVDUP>'] }))).toBe('INVDUP') // passthrough
  })

  it('keeps the specific copy number from a <CNx> ALT', () => {
    expect(getVariantSvType(feat({ ALT: ['<CN0>'] }))).toBe('CN0')
    expect(getVariantSvType(feat({ ALT: ['<CN3>'] }))).toBe('CN3')
    // ALT wins over a generic SVTYPE=CNV so the copy number survives
    expect(
      getVariantSvType(feat({ INFO: { SVTYPE: ['CNV'] }, ALT: ['<CN3>'] })),
    ).toBe('CN3')
  })

  it('falls back to SVTYPE only when the ALT is uninformative', () => {
    expect(
      getVariantSvType(feat({ INFO: { SVTYPE: ['DEL'] }, ALT: ['ACGT'] })),
    ).toBe('DEL')
    expect(
      getVariantSvType(feat({ INFO: { SVTYPE: ['.'] }, ALT: ['A'] })),
    ).toBe('')
  })

  it('flags a multi-class multiallelic site as MIXED', () => {
    expect(getVariantSvType(feat({ ALT: ['<DEL>', '<DUP>'] }))).toBe('MIXED')
    // MIXED wins even when SVTYPE names one class
    expect(
      getVariantSvType(
        feat({ INFO: { SVTYPE: ['DEL'] }, ALT: ['<DEL>', '<DUP>'] }),
      ),
    ).toBe('MIXED')
  })

  it('collapses a multi-copy-number site to the generic CNV bucket, not MIXED', () => {
    expect(getVariantSvType(feat({ ALT: ['<CN0>', '<CN3>'] }))).toBe('CNV')
  })

  it('is empty for the gVCF and mpileup any-other-allele symbols', () => {
    expect(getVariantSvType(feat({ REF: 'A', ALT: ['<NON_REF>'] }))).toBe('')
    expect(getVariantSvType(feat({ REF: 'A', ALT: ['G', '<*>'] }))).toBe('')
  })

  it('is empty for plain SNVs and indels under SV size', () => {
    expect(getVariantSvType(feat({ REF: 'G', ALT: ['A'] }))).toBe('')
    expect(getVariantSvType(feat({ REF: 'G', ALT: ['ACGT'] }))).toBe('')
    expect(
      getVariantSvType(feat({ REF: 'G', ALT: [`G${'A'.repeat(49)}`] })),
    ).toBe('')
  })

  // A decomposed pangenome callset spells its SVs as plain sequence alleles
  // with no symbolic ALT and no SVTYPE, so the class has to come from length.
  it('classes a sequence indel of SV size by its length', () => {
    expect(
      getVariantSvType(feat({ REF: 'G', ALT: [`G${'A'.repeat(50)}`] })),
    ).toBe('INS')
    expect(
      getVariantSvType(feat({ REF: `G${'A'.repeat(71)}`, ALT: ['G'] })),
    ).toBe('DEL')
    expect(
      getVariantSvType(
        feat({ REF: 'G', ALT: [`G${'A'.repeat(60)}`, `G${'C'.repeat(60)}`] }),
      ),
    ).toBe('INS')
  })
})

describe('getVariantSvTypeColor (single-variant fixed-color jexl)', () => {
  it('returns the predefined class color', () => {
    expect(getVariantSvTypeColor(feat({ ALT: ['<DEL>'] }))).toBe('#e41a1c')
  })
  it('returns the copy-number rainbow color for a CN state', () => {
    expect(getVariantSvTypeColor(feat({ ALT: ['<CN0>'] }))).toBe(
      'hsl(240, 70%, 50%)',
    )
  })
  it('returns neutral grey for a non-SV or unrecognized token', () => {
    expect(getVariantSvTypeColor(feat({ ALT: ['A'] }))).toBe('#808080') // SNV
    expect(getVariantSvTypeColor(feat({ ALT: ['<WEIRD>'] }))).toBe('#808080')
  })
})

describe('svTypeLegendEntries', () => {
  const colors = () => svTypeLegendEntries().map(e => e.color)

  it('names every predefined class colour the painter hands out', () => {
    for (const alt of ['<DEL>', '<DUP>', '<INS>', '<INV>', '<CNV>', '<BND>']) {
      expect(colors()).toContain(getVariantSvTypeColor(feat({ ALT: [alt] })))
    }
  })

  it('names the grey a non-SV or unrecognized record paints, last', () => {
    const rows = svTypeLegendEntries()
    const grey = getVariantSvTypeColor(feat({ ALT: ['A'] }))
    expect(rows.at(-1)).toMatchObject({ color: grey, missing: true })
    expect(rows.at(-1)!.label).toMatch(/SNV/)
    expect(getVariantSvTypeColor(feat({ ALT: ['<WEIRD>'] }))).toBe(grey)
  })
})

describe('assignSvTypeColors', () => {
  it('assigns predefined colors to known buckets in canonical order', () => {
    const colors = assignSvTypeColors(['DUP', 'DEL'])
    expect(Object.keys(colors)).toEqual(['DEL', 'DUP'])
    expect(colors.DEL).toBe('#e41a1c')
    expect(colors.DUP).toBe('#377eb8')
  })

  it('auto-assigns palette colors to unrecognized tokens, after known buckets, alphabetically', () => {
    const colors = assignSvTypeColors(['ZZZ', 'DEL', 'AAA'])
    expect(Object.keys(colors)).toEqual(['DEL', 'AAA', 'ZZZ'])
    // predefined color for DEL, palette colors for the rest, none colliding
    const values = Object.values(colors)
    expect(new Set(values).size).toBe(values.length)
  })

  it('keeps an unrecognized token its colour whatever else is in view', () => {
    const alone = assignSvTypeColors(['FOO'])
    expect(assignSvTypeColors(['FOO', 'DEL', 'DUP', 'CN2']).FOO).toBe(alone.FOO)
  })

  it('names the gnomAD-SV complex and translocation classes', () => {
    const colors = assignSvTypeColors(['CPX', 'BND'])
    expect(colors.CPX).toBe('#4daf4a')
    expect(getVariantSvType(feat({ ALT: ['<CTX>'] }))).toBe('BND')
  })

  it('colors copy-number states with an absolute rainbow, ordered ascending', () => {
    const colors = assignSvTypeColors(['CN3', 'CN0', 'DEL'])
    // known bucket first, then copy numbers ascending
    expect(Object.keys(colors)).toEqual(['DEL', 'CN0', 'CN3'])
    // absolute mapping: CN0 is the blue end of the spectrum
    expect(colors.CN0).toBe('hsl(240, 70%, 50%)')
    expect(colors.CN3).not.toBe(colors.CN0)
  })

  it('gives a copy number a stable color regardless of the present set', () => {
    const a = assignSvTypeColors(['CN3', 'CN5'])
    const b = assignSvTypeColors(['CN0', 'CN3', 'CN9'])
    expect(a.CN3).toBe(b.CN3) // absolute, not rank-based
  })

  it('does not reuse a predefined class color for an unknown token', () => {
    // regression: DUP (set1 blue) and an unrecognized CPX token must not share
    // a color — the unknown skips every color a known class already took
    const colors = assignSvTypeColors(['DUP', 'FOO', 'DEL'])
    expect(colors.DUP).toBe('#377eb8')
    expect(colors.FOO).not.toBe(colors.DUP)
    expect(colors.FOO).not.toBe(colors.DEL)
  })

  it('is deterministic', () => {
    const a = assignSvTypeColors(['INV', 'FOO', 'DEL'])
    const b = assignSvTypeColors(['DEL', 'FOO', 'INV'])
    expect(a).toEqual(b)
  })

  it('is empty for no types', () => {
    expect(assignSvTypeColors([])).toEqual({})
  })

  it('paints the non-structural member the default alt hue, last', () => {
    const colors = assignSvTypeColors(['FOO', NON_SV_TYPE, 'DEL'])
    expect(colors[NON_SV_TYPE]).toBe(ALT_HUE)
    expect(Object.keys(colors).at(-1)).toBe(NON_SV_TYPE)
    // excluded from the set1 auto-assignment, so a real token still gets set1
    expect(colors.FOO).not.toBe(ALT_HUE)
    expect(set1).toContain(colors.FOO)
  })
})

describe('svTypeDisplayLabel', () => {
  it('labels known buckets and passes through unknown tokens', () => {
    expect(svTypeDisplayLabel('DEL')).toBe('Deletion')
    expect(svTypeDisplayLabel('BND')).toBe('Breakend')
    expect(svTypeDisplayLabel('MIXED')).toBe('Mixed')
    expect(svTypeDisplayLabel('INVDUP')).toBe('INVDUP')
  })
})
