import {
  categoricalColor,
  categoricalPalette,
  categoricalScale,
  categoricalValueColor,
} from './colors.ts'

const BIOTYPES = [
  'protein_coding',
  'lncRNA',
  'pseudogene',
  'snoRNA',
  'snRNA',
  'miRNA',
  'misc_RNA',
  'tRNA',
  'rRNA',
  'scaRNA',
  'Y_RNA',
  'vault_RNA',
  'antisense_RNA',
  'transcribed_pseudogene',
  'processed_pseudogene',
  'unprocessed_pseudogene',
  'IG_C_gene',
  'IG_D_gene',
  'IG_J_gene',
  'IG_V_gene',
  'TR_C_gene',
  'TR_V_gene',
  'Mt_rRNA',
  'Mt_tRNA',
  'ribozyme',
  'sRNA',
  'TEC',
  'telomerase_RNA',
  'RNase_MRP_RNA',
  'RNase_P_RNA',
]

test('a non-negative integer takes the palette slot it names, anchored at 1', () => {
  expect(categoricalValueColor('1')).toBe(categoricalPalette[0])
  expect(categoricalValueColor('2')).toBe(categoricalPalette[1])
  expect(categoricalValueColor('0')).toBe(categoricalPalette.at(-1))
})

test('any other value hashes into the palette and stays put', () => {
  const color = categoricalValueColor('chr7')
  expect(categoricalPalette).toContain(color)
  expect(categoricalValueColor('chr7')).toBe(color)
  expect(categoricalValueColor('')).toBe(categoricalPalette[0])
})

describe('categoricalScale', () => {
  it('with no domain is categoricalValueColor, over whichever range it is given', () => {
    const scale = categoricalScale(undefined, categoricalPalette)
    for (const value of [...BIOTYPES, '1', '7']) {
      expect(scale(value)).toBe(categoricalValueColor(value))
    }
    expect(categoricalScale([], ['a', 'b'])('2')).toBe('b')
  })

  it('spends the range in domain order, then the fallback it lacks', () => {
    const scale = categoricalScale(
      ['x', 'y', 'z'],
      ['red', '#1F77B4'],
      ['#1f77b4', 'green'],
    )
    expect(['x', 'y', 'z'].map(scale)).toEqual(['red', '#1F77B4', 'green'])
  })

  it('never paints an unlisted value a listed color while the range has room', () => {
    for (const listedCount of [1, 4, 10, 25]) {
      const domain = BIOTYPES.slice(0, listedCount)
      const scale = categoricalScale(domain, categoricalPalette)
      const listed = new Set(domain.map(scale))
      for (const value of [...BIOTYPES.slice(listedCount), '1', '2', '0']) {
        expect(listed).not.toContain(scale(value))
      }
    }
  })

  it('sends unlisted values past a spent palette into the fallback, not onto it', () => {
    const palette = ['#1f77b4', '#ff7f0e']
    const scale = categoricalScale(
      ['protein_coding', 'lncRNA'],
      palette,
      categoricalPalette,
    )
    for (const value of BIOTYPES.slice(2)) {
      expect(palette).not.toContain(scale(value))
      expect(categoricalPalette).toContain(scale(value))
    }
  })

  it('moves an unlisted value only when a new listed value takes its slot', () => {
    const before = categoricalScale(BIOTYPES.slice(0, 5), categoricalPalette)
    const after = categoricalScale(BIOTYPES.slice(0, 6), categoricalPalette)
    const claimed = after(BIOTYPES[5]!)
    for (const value of BIOTYPES.slice(6)) {
      if (before(value) !== claimed) {
        expect(after(value)).toBe(before(value))
      }
    }
  })

  it('reorders listed values without moving unlisted ones', () => {
    const domain = BIOTYPES.slice(0, 8)
    const a = categoricalScale(domain, categoricalPalette)
    const b = categoricalScale([...domain].reverse(), categoricalPalette)
    for (const value of BIOTYPES.slice(8)) {
      expect(b(value)).toBe(a(value))
    }
  })

  it('wraps a domain past every entry it has', () => {
    const scale = categoricalScale(['a', 'b', 'c', 'd'], ['disc', 'triangle'])
    expect(['a', 'b', 'c', 'd'].map(scale)).toEqual([
      'disc',
      'triangle',
      'disc',
      'triangle',
    ])
    expect(['disc', 'triangle']).toContain(scale('e'))
  })

  it('ignores the catch-all key in a domain', () => {
    expect(categoricalScale(['', 'a'], ['red', 'blue'])('a')).toBe('red')
  })
})

describe('categoricalColor', () => {
  it('spends the palette in domain order', () => {
    expect(categoricalColor('b', ['a', 'b'], ['red', 'blue'])).toBe('blue')
    expect(categoricalColor('b', ['a', 'b'])).toBe(categoricalPalette[1])
  })

  it('is categoricalScale over the default palette', () => {
    const scale = categoricalScale(
      ['protein_coding'],
      ['red'],
      categoricalPalette,
    )
    for (const value of BIOTYPES) {
      expect(categoricalColor(value, ['protein_coding'], ['red'])).toBe(
        scale(value),
      )
    }
  })

  it('paints a missing value grey, and a list the way a group key joins it', () => {
    expect(categoricalColor(undefined)).toBe(categoricalColor(''))
    expect(categoricalPalette).not.toContain(categoricalColor(undefined))
    expect(categoricalColor(['a', 'b'], ['a,b'], ['red'])).toBe('red')
  })
})
