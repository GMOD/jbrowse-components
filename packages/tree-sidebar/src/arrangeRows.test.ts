import {
  arrangeRows,
  bandRows,
  orderRowsByDomain,
  rowAliasOver,
} from './arrangeRows.ts'
import { keptRows } from './clusterUtils.ts'

import type { ArrangeRowsHooks, RowParent } from './arrangeRows.ts'
import type { RowSource } from './types.ts'

interface HaplotypeRow extends RowSource {
  sampleName: string
  HP?: number
}

// A variant display's rows: a sample, or its haplotypes "<sample> HP1",
// "<sample> HP2", each reading its sample off its own `sampleName` and `HP`
function sampleRow(sampleName: string): HaplotypeRow {
  return { name: sampleName, sampleName }
}

function haplotypeRows(sampleName: string, ploidy = 2): HaplotypeRow[] {
  return Array.from({ length: ploidy }, (_, HP) => ({
    name: `${sampleName} HP${HP + 1}`,
    sampleName,
    HP,
    ...(ploidy === 1 ? { label: sampleName } : {}),
  }))
}

function haplotypeParent(row: HaplotypeRow): RowParent | undefined {
  return row.HP === undefined
    ? undefined
    : {
        name: row.sampleName,
        labelSuffix: row.label === row.sampleName ? '' : ` HP${row.HP + 1}`,
      }
}

function phasedHooks(rows: HaplotypeRow[]): ArrangeRowsHooks<HaplotypeRow> {
  return {
    unlistedRowsSort: 'source',
    rowAlias: rowAliasOver(rows, [], haplotypeParent),
    rowParent: haplotypeParent,
  }
}

// sample mode: the samples drawn, their haplotype rows the finer ones
function sampleHooks(
  samples: string[],
  ploidy = 2,
): ArrangeRowsHooks<HaplotypeRow> {
  return {
    unlistedRowsSort: 'source',
    rowAlias: rowAliasOver(
      samples.map(sampleRow),
      samples.flatMap(sample => haplotypeRows(sample, ploidy)),
      haplotypeParent,
    ),
    rowParent: haplotypeParent,
  }
}

const hooks: ArrangeRowsHooks<RowSource> = {
  unlistedRowsSort: 'source',
  rowAlias: undefined,
  rowParent: () => undefined,
}
const none = { domain: [], labels: {} }
const names = (rows: { name: string }[]) => rows.map(r => r.name)

describe('orderRowsByDomain', () => {
  const rows = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]

  test('an empty domain returns the input array itself', () => {
    expect(orderRowsByDomain(rows, [])).toBe(rows)
  })

  test('a domain naming none of the rows returns the input array itself', () => {
    expect(orderRowsByDomain(rows, ['ghost'])).toBe(rows)
  })

  test('listed rows come first in the domain order', () => {
    expect(orderRowsByDomain(rows, ['kid', 'dad'])).toEqual([
      { name: 'kid' },
      { name: 'dad' },
      { name: 'mom' },
    ])
  })

  // The rest keep the order they arrived in — the tree's leaf order, the
  // adapter's, the file's — rather than being sorted the way a facet's
  // unlisted sections are.
  test('the rest keep the order they arrived in', () => {
    const many = ['e', 'd', 'c', 'b', 'a'].map(name => ({ name }))
    expect(orderRowsByDomain(many, ['c']).map(r => r.name)).toEqual([
      'c',
      'e',
      'd',
      'b',
      'a',
    ])
  })

  test('a listed name with no row places nothing', () => {
    expect(orderRowsByDomain(rows, ['ghost', 'kid']).map(r => r.name)).toEqual([
      'kid',
      'mom',
      'dad',
    ])
  })

  test('a name listed twice places its row once', () => {
    expect(orderRowsByDomain(rows, ['kid', 'kid']).map(r => r.name)).toEqual([
      'kid',
      'mom',
      'dad',
    ])
  })

  test('the rows themselves pass through, overrides and all', () => {
    const decorated = [
      { name: 'mom', label: 'Mother', color: 'red' },
      { name: 'kid', label: 'Child' },
    ]
    expect(orderRowsByDomain(decorated, ['kid'])).toEqual([
      { name: 'kid', label: 'Child' },
      { name: 'mom', label: 'Mother', color: 'red' },
    ])
  })
})

describe('orderRowsByDomain with an alias', () => {
  const haplotypes = ['HG001', 'HG002', 'HG003'].flatMap(sample =>
    haplotypeRows(sample),
  )
  const alias = rowAliasOver(haplotypes, [], haplotypeParent)

  test('a sample name places each of its haplotypes, in the order they came', () => {
    expect(
      names(orderRowsByDomain(haplotypes, ['HG003', 'HG002 HP2'], alias)),
    ).toEqual([
      'HG003 HP1',
      'HG003 HP2',
      'HG002 HP2',
      'HG001 HP1',
      'HG001 HP2',
      'HG002 HP1',
    ])
  })

  test('an order that moves nothing hands back the rows', () => {
    expect(orderRowsByDomain(haplotypes, ['HG001'], alias)).toBe(haplotypes)
  })
})

describe('sort across the haplotype switch', () => {
  const samples = ['A', 'B', 'C']
  const phased = samples.flatMap(sample => haplotypeRows(sample))
  const sampled = samples.map(sampleRow)
  const arranged = (
    rows: HaplotypeRow[],
    domain: string[],
    with_: ArrangeRowsHooks<HaplotypeRow>,
  ) => names(arrangeRows(rows, { domain, labels: {} }, with_))

  test('a row ranks at the earlier of its own entry and its sample entry', () => {
    expect(
      arranged(phased, ['B HP2', 'C', 'A HP1', 'B'], phasedHooks(phased)),
    ).toEqual(['B HP2', 'C HP1', 'C HP2', 'A HP1', 'B HP1', 'A HP2'])
  })

  test('collapsing, a sample ranks at its first haplotype entry', () => {
    expect(
      arranged(
        sampled,
        ['C HP2', 'A HP1', 'C HP1', 'B HP2'],
        sampleHooks(samples),
      ),
    ).toEqual(['C', 'A', 'B'])
  })

  test("a sample's own entry ranks it where it comes before its haplotypes'", () => {
    expect(
      arranged(sampled, ['B', 'A HP1', 'B HP1'], sampleHooks(samples)),
    ).toEqual(['B', 'A', 'C'])
  })

  // phased reorder, then a sample-mode reorder writing its rows ahead of the
  // haplotype entries (`orderOver`), then phased again: the latest wins
  test('the latest reorder wins at either field', () => {
    const phasedOrder = ['C HP1', 'A HP2', 'C HP2', 'A HP1', 'B HP1', 'B HP2']
    expect(arranged(sampled, phasedOrder, sampleHooks(samples))).toEqual([
      'C',
      'A',
      'B',
    ])
    const sampleOrder = ['B', 'A', 'C', ...phasedOrder]
    expect(arranged(phased, sampleOrder, phasedHooks(phased))).toEqual([
      'B HP1',
      'B HP2',
      'A HP1',
      'A HP2',
      'C HP1',
      'C HP2',
    ])
  })

  test('a haplotype entry ranks no sibling in phased mode', () => {
    expect(arranged(phased, ['B HP2'], phasedHooks(phased))).toEqual([
      'B HP2',
      'A HP1',
      'A HP2',
      'B HP1',
      'C HP1',
      'C HP2',
    ])
  })
})

describe('arrangeRows', () => {
  const rows: RowSource[] = [
    { name: 'a', color: 'red' },
    { name: 'b', label: 'Bee' },
    { name: 'c' },
  ]

  test('nothing arranged hands back the rows themselves', () => {
    expect(arrangeRows(rows, none, hooks)).toBe(rows)
  })

  test('entries naming no row, or repeating it, hand back the rows', () => {
    expect(
      arrangeRows(
        rows,
        {
          domain: ['a'],
          labels: { b: 'Bee', ghost: 'Boo' },
        },
        hooks,
      ),
    ).toBe(rows)
  })

  test('a label replaces the row label and leaves its color', () => {
    const out = arrangeRows(rows, { domain: ['c'], labels: { a: 'Ay' } }, hooks)
    expect(out).toEqual([
      { name: 'c' },
      { name: 'a', color: 'red', label: 'Ay' },
      { name: 'b', label: 'Bee' },
    ])
    expect(out[0]).toBe(rows[2])
    expect(out[2]).toBe(rows[1])
  })

  test('sorted: unlisted rows sort, digits by magnitude, the empty row last', () => {
    const values = ['s10', '', 'mom', 's2', 'dad'].map(name => ({ name }))
    expect(
      names(
        arrangeRows(
          values,
          { ...none, domain: ['s10'] },
          { ...hooks, unlistedRowsSort: 'sorted' },
        ),
      ),
    ).toEqual(['s10', 'dad', 'mom', 's2', ''])
  })

  test('sorted: rows already in order are handed back', () => {
    const values = ['dad', 'mom', 's2', 's10'].map(name => ({ name }))
    expect(
      arrangeRows(values, none, { ...hooks, unlistedRowsSort: 'sorted' }),
    ).toBe(values)
  })

  test("a row's own label exactly, else its sample's composed with its haplotype", () => {
    const haplotypes = ['HG001', 'HG002'].flatMap(sample =>
      haplotypeRows(sample),
    )
    const out = arrangeRows(
      haplotypes,
      {
        domain: [],
        labels: { 'HG001 HP2': 'paternal', HG002: 'Mother' },
      },
      phasedHooks(haplotypes),
    )
    expect(out.map(row => row.label)).toEqual([
      undefined,
      'paternal',
      'Mother HP1',
      'Mother HP2',
    ])
  })

  test("a haploid sample's one row takes the bare sample label", () => {
    const rows = [...haplotypeRows('X', 1), ...haplotypeRows('Y')]
    const out = arrangeRows(
      rows,
      { domain: [], labels: { X: 'Father', Y: 'Mother' } },
      phasedHooks(rows),
    )
    expect(out.map(row => row.label)).toEqual([
      'Father',
      'Mother HP1',
      'Mother HP2',
    ])
  })

  test('a haplotype entry waits unseen in sample mode', () => {
    const out = arrangeRows(
      [sampleRow('X'), sampleRow('Y')],
      { domain: [], labels: { 'X HP1': 'paternal', Y: 'Mother' } },
      sampleHooks(['X', 'Y']),
    )
    expect(out.map(row => row.label)).toEqual([undefined, 'Mother'])
  })

  test('a row called constructor reads no inherited label', () => {
    const [row] = arrangeRows<RowSource>(
      [{ name: 'constructor' }],
      { ...none, labels: { other: 'x' } },
      hooks,
    )
    expect(row!.label).toBeUndefined()
  })
})

describe('keptRows with an alias', () => {
  const samples = [sampleRow('HG001'), sampleRow('HG002'), sampleRow('HG003')]
  const haplotypes = ['HG001', 'HG002'].flatMap(sample => haplotypeRows(sample))
  const alias = rowAliasOver(
    haplotypes,
    ['HG001', 'HG002', 'HG003'].flatMap(sample => haplotypeRows(sample)),
    haplotypeParent,
  )
  const sampleAlias = sampleHooks(['HG001', 'HG002', 'HG003']).rowAlias

  test('a focus on a haplotype keeps its sample, in sample mode', () => {
    expect(names(keptRows(samples, ['HG002 HP2'], sampleAlias))).toEqual([
      'HG002',
    ])
  })

  test('a focus on a haplotype keeps its sample, for the fetch', () => {
    expect(names(keptRows(samples, ['HG002 HP1'], alias))).toEqual(['HG002'])
  })

  test('and only that haplotype among the rows drawn', () => {
    expect(names(keptRows(haplotypes, ['HG002 HP2'], alias))).toEqual([
      'HG002 HP2',
    ])
  })

  test('a sample name keeps all of its haplotypes', () => {
    expect(names(keptRows(haplotypes, ['HG001'], alias))).toEqual([
      'HG001 HP1',
      'HG001 HP2',
    ])
  })

  // The display says so in a notice rather than drawing every row
  test('a focus naming no current row keeps none, and no focus keeps every row', () => {
    expect(keptRows(samples, ['NA0001'], sampleAlias)).toEqual([])
    expect(keptRows(samples, undefined, sampleAlias)).toBe(samples)
    expect(keptRows(samples, [], sampleAlias)).toBe(samples)
  })
})

describe('bandRows', () => {
  const pop = (row: { pop?: string }) => row.pop ?? ''
  const band = (
    rows: { name: string; pop?: string }[],
    domain: string[] = [],
  ) => bandRows(rows, pop, { field: 'pop', sort: domain })
  const sources = [
    { name: 's1', pop: 'EUR' },
    { name: 's2', pop: 'AFR' },
    { name: 's3', pop: 'EUR' },
    { name: 's4', pop: 'AFR' },
    { name: 's5', pop: 'AFR' },
  ]

  test('stacks each band contiguous, in sorted value order, arranged within', () => {
    const { rows, bands } = band(sources)
    expect(names(rows)).toEqual(['s2', 's4', 's5', 's1', 's3'])
    expect(bands).toEqual([
      { key: 'AFR', label: 'AFR', start: 0, end: 3 },
      { key: 'EUR', label: 'EUR', start: 3, end: 5 },
    ])
  })

  test('orders bands by value, not by size', () => {
    const lopsided = [
      { name: 'a', pop: 'ZZZ' },
      { name: 'b', pop: 'ZZZ' },
      { name: 'c', pop: 'AAA' },
    ]
    expect(names(band(lopsided).rows)).toEqual(['c', 'a', 'b'])
  })

  test('stacks the bands a domain lists first, the rest sorted behind', () => {
    expect(names(band(sources, ['EUR']).rows)).toEqual([
      's1',
      's3',
      's2',
      's4',
      's5',
    ])
    const three = [
      { name: 'a', pop: 'EUR' },
      { name: 'b', pop: 'SAS' },
      { name: 'c', pop: 'AFR' },
    ]
    expect(names(band(three, ['SAS']).rows)).toEqual(['b', 'c', 'a'])
  })

  test('stacks the rows with no value last, labelled for the field', () => {
    const mixed = [
      { name: 'x' },
      { name: 'y', pop: 'EUR' },
      { name: 'z' },
      { name: 'w', pop: 'EUR' },
    ]
    const { rows, bands } = band(mixed)
    expect(names(rows)).toEqual(['y', 'w', 'x', 'z'])
    expect(bands.at(-1)).toEqual({
      key: '',
      label: '(no pop)',
      start: 2,
      end: 4,
    })
  })

  test('bands nothing, and hands the rows back, where no row has a value', () => {
    const bare = [{ name: 'a' }, { name: 'b' }]
    expect(band(bare)).toEqual({ rows: bare, bands: [] })
    expect(band(bare).rows).toBe(bare)
  })

  test('hands the rows back where the bands already stack', () => {
    const stacked = [
      { name: 'a', pop: 'AFR' },
      { name: 'b', pop: 'EUR' },
    ]
    expect(band(stacked).rows).toBe(stacked)
  })
})
