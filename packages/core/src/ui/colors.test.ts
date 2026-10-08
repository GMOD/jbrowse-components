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

describe('a dealt scale', () => {
  it('paints the values the hash puts on one color each its own', () => {
    const hashed = categoricalColorScale(undefined)
    expect(new Set(['protein_coding', 'snRNA', 'TEC'].map(hashed)).size).toBe(1)
    const dealt = categoricalColorScale(undefined, [], new Map())
    expect(new Set(['protein_coding', 'snRNA', 'TEC'].map(dealt)).size).toBe(3)
  })

  it('keeps a value its hashed color while no value met before has it', () => {
    const dealt = categoricalColorScale(undefined, [], new Map())
    const hashed = categoricalColorScale(undefined)
    const met: string[] = []
    let kept = 0
    for (const value of BIOTYPES) {
      const free = !met.some(c => similarColors(c, hashed(value)))
      met.push(dealt(value))
      if (free) {
        expect(dealt(value)).toBe(hashed(value))
        kept++
      } else {
        expect(dealt(value)).not.toBe(hashed(value))
      }
    }
    expect(kept).toBeGreaterThan(5)
  })

  it('deals 30 values 30 colors none of which read alike', () => {
    const dealt = categoricalColorScale(undefined, [], new Map())
    const colors = BIOTYPES.map(dealt)
    for (const [i, a] of colors.entries()) {
      for (const b of colors.slice(i + 1)) {
        expect(similarColors(a, b)).toBe(false)
      }
    }
  })

  it('never moves a held value as others arrive', () => {
    const held = new Map<string, number>()
    const first = categoricalColorScale(undefined, [], held)
    const before = BIOTYPES.slice(0, 5).map(first)
    BIOTYPES.slice(5).forEach(first)
    const later = categoricalColorScale(undefined, [], held)
    expect(BIOTYPES.slice(0, 5).map(later)).toEqual(before)
  })

  it('keeps a listed value its range color and deals the rest around it', () => {
    const dealt = categoricalColorScale(['lncRNA'], ['#e41a1c'], new Map())
    expect(dealt('lncRNA')).toBe('#e41a1c')
    const others = ['protein_coding', 'snRNA', 'TEC'].map(dealt)
    expect(new Set(others).size).toBe(3)
    expect(others.some(c => similarColors(c, '#e41a1c'))).toBe(false)
  })

  it('deals a range before spilling into the wide palette', () => {
    const range = ['#1f77b4', '#ff7f0e']
    const dealt = categoricalColorScale(undefined, range, new Map())
    const colors = ['a', 'b', 'c', 'd'].map(dealt)
    expect(colors.slice(0, 2).sort()).toEqual([...range].sort())
    expect(new Set(colors).size).toBe(4)
    expect(range).not.toContain(colors[2])
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

  it('reads a comma-separated color list, functions included', () => {
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
