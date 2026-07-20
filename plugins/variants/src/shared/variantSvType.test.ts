import { SimpleFeature } from '@jbrowse/core/util'

import {
  assignSvTypeColors,
  featureHasSvType,
  getVariantSvType,
  svTypeDisplayLabel,
} from './variantSvType.ts'

function feat(data: Record<string, unknown>) {
  return new SimpleFeature({ uniqueId: 'x', refName: 'ctgA', start: 0, end: 1, ...data })
}

describe('getVariantSvType', () => {
  it('reads INFO.SVTYPE (array) as the canonical bucket', () => {
    expect(getVariantSvType(feat({ INFO: { SVTYPE: ['DEL'] }, ALT: ['<DEL>'] }))).toBe('DEL')
    expect(getVariantSvType(feat({ INFO: { SVTYPE: ['TRA'] }, ALT: ['<TRA>'] }))).toBe('BND')
    expect(getVariantSvType(feat({ INFO: { SVTYPE: ['DUP:TANDEM'] }, ALT: ['<DUP:TANDEM>'] }))).toBe('DUP')
  })

  it('passes through an unrecognized SVTYPE token uppercased', () => {
    expect(getVariantSvType(feat({ INFO: { SVTYPE: ['invdup'] }, ALT: ['<INVDUP>'] }))).toBe('INVDUP')
  })

  it('derives from a symbolic/breakend ALT when SVTYPE is absent', () => {
    expect(getVariantSvType(feat({ ALT: ['<DEL>'] }))).toBe('DEL')
    expect(getVariantSvType(feat({ ALT: ['G[ctgA:200['] }))).toBe('BND')
    expect(getVariantSvType(feat({ ALT: ['<CN0>'] }))).toBe('CNV')
  })

  it('flags a multi-class multiallelic site as MIXED', () => {
    expect(getVariantSvType(feat({ ALT: ['<DEL>', '<DUP>'] }))).toBe('MIXED')
    // MIXED wins even when SVTYPE names one class
    expect(getVariantSvType(feat({ INFO: { SVTYPE: ['DEL'] }, ALT: ['<DEL>', '<DUP>'] }))).toBe('MIXED')
  })

  it('does not flag a same-class multiallelic site (e.g. CNV copy states)', () => {
    expect(getVariantSvType(feat({ ALT: ['<CN0>', '<CN3>'] }))).toBe('CNV')
  })

  it('is empty for plain (non-symbolic) SNVs and indels', () => {
    expect(getVariantSvType(feat({ ALT: ['A'] }))).toBe('')
    expect(getVariantSvType(feat({ ALT: ['ACGT'] }))).toBe('')
  })

  it('ignores a missing-value SVTYPE and falls back to ALT', () => {
    expect(getVariantSvType(feat({ INFO: { SVTYPE: ['.'] }, ALT: ['A'] }))).toBe('')
  })
})

describe('featureHasSvType', () => {
  it('true for an SV, false for a plain SNV', () => {
    expect(featureHasSvType(feat({ INFO: { SVTYPE: ['DEL'] }, ALT: ['<DEL>'] }))).toBe(true)
    expect(featureHasSvType(feat({ ALT: ['A'] }))).toBe(false)
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

  it('does not reuse a predefined class color for an unknown token', () => {
    // regression: DUP (set1 blue) and an unrecognized CPX token must not share
    // a color — the unknown skips every color a known class already took
    const colors = assignSvTypeColors(['DUP', 'CPX', 'DEL'])
    expect(colors.DUP).toBe('#377eb8')
    expect(colors.CPX).not.toBe(colors.DUP)
    expect(colors.CPX).not.toBe(colors.DEL)
  })

  it('is deterministic', () => {
    const a = assignSvTypeColors(['INV', 'FOO', 'DEL'])
    const b = assignSvTypeColors(['DEL', 'FOO', 'INV'])
    expect(a).toEqual(b)
  })

  it('is empty for no types', () => {
    expect(assignSvTypeColors([])).toEqual({})
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
