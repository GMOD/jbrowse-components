import {
  categoricalColor,
  categoricalColorScale,
  categoricalPalette,
  categoricalScale,
  categoricalValueColor,
  paletteFromSpec,
  set1,
  similarColors,
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
    const scale = categoricalScale(['x', 'y', 'z'], ['red', '#1F77B4'], {
      fallback: ['#1f77b4', 'green'],
    })
    expect(['x', 'y', 'z'].map(scale)).toEqual(['red', '#1F77B4', 'green'])
  })

  it('never paints an unlisted value a listed entry while the list has room', () => {
    for (const listedCount of [1, 4, 10, 25]) {
      const domain = BIOTYPES.slice(0, listedCount)
      const scale = categoricalScale(domain, categoricalPalette)
      const listed = new Set(domain.map(scale))
      for (const value of [...BIOTYPES.slice(listedCount), '1', '2', '0']) {
        expect(listed).not.toContain(scale(value))
      }
    }
  })

  it('moves an unlisted value only when a new listed value takes its slot, at any domain length', () => {
    for (const [palette, from] of [
      [['#1f77b4', '#ff7f0e'], 1],
      [[], 5],
      [[], 39],
    ] as const) {
      const values = [...BIOTYPES, ...BIOTYPES.map(b => `${b}_2`)]
      const before = categoricalColorScale(values.slice(0, from), palette)
      const after = categoricalColorScale(values.slice(0, from + 1), palette)
      const claimed = after(values[from]!)
      const moved = values
        .slice(from + 1)
        .filter(
          value =>
            before(value) !== after(value) &&
            !similarColors(before(value), claimed),
        )
      expect(moved).toEqual([])
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

describe('categoricalColorScale', () => {
  it('sends unlisted values past a spent palette into the wide one, never onto it', () => {
    const palette = ['#1f77b4', '#ff7f0e']
    const scale = categoricalColorScale(['protein_coding', 'lncRNA'], palette)
    for (const value of BIOTYPES.slice(2)) {
      expect(palette.some(c => similarColors(c, scale(value)))).toBe(false)
      expect(categoricalPalette).toContain(scale(value))
    }
  })

  it('keeps unlisted values off any color that reads the same as a listed one', () => {
    const domain = BIOTYPES.slice(0, 10)
    const scale = categoricalColorScale(domain)
    const listed = domain.map(scale)
    for (let i = 0; i < 2000; i++) {
      const color = scale(`value${i}`)
      expect(listed.some(c => similarColors(c, color))).toBe(false)
    }
  })
})

describe('categoricalColor', () => {
  it('spends the palette in domain order', () => {
    expect(categoricalColor('b', ['a', 'b'], ['red', 'blue'])).toBe('blue')
    expect(categoricalColor('b', ['a', 'b'])).toBe(categoricalPalette[1])
  })

  it('is categoricalColorScale, whichever declarations alternate', () => {
    const one = categoricalColorScale(['protein_coding'], ['red'])
    const two = categoricalColorScale(['lncRNA'])
    for (const value of BIOTYPES) {
      expect(categoricalColor(value, ['protein_coding'], ['red'])).toBe(
        one(value),
      )
      expect(categoricalColor(value, ['lncRNA'])).toBe(two(value))
    }
  })

  it('paints a missing value grey, and a list the way a group key joins it', () => {
    expect(categoricalColor(undefined)).toBe(categoricalColor(''))
    expect(categoricalPalette).not.toContain(categoricalColor(undefined))
    expect(categoricalColor(['a', 'b'], ['a,b'], ['red'])).toBe('red')
  })
})

describe('paletteFromSpec', () => {
  it('names a palette', () => {
    expect(paletteFromSpec('set1')).toBe(set1)
    expect(paletteFromSpec('relit')).toHaveLength(27)
  })

  it('reads a comma-separated colour list, functions included', () => {
    expect(paletteFromSpec('#f00, rgb(0, 128, 0),steelblue')).toEqual([
      '#f00',
      'rgb(0, 128, 0)',
      'steelblue',
    ])
  })

  it('reads nothing else, and says so', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(paletteFromSpec(undefined)).toBeUndefined()
    expect(paletteFromSpec('tableau11')).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
