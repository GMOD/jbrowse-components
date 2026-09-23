import { arrangeRows, orderRowsByDomain } from './arrangeRows.ts'
import { keptRows } from './clusterUtils.ts'

import type { ArrangeRowsHooks, RowAlias } from './arrangeRows.ts'
import type { RowSource } from './types.ts'

// A variant display's haplotype rows, "<sample> HP<n>", each answering to its
// sample, and a sample row to itself.
function haplotypeAlias(samples: string[]): RowAlias {
  const known = new Set(samples)
  return name => {
    if (known.has(name)) {
      return name
    }
    const sample = / HP\d+$/.test(name) ? name.replace(/ HP\d+$/, '') : ''
    return known.has(sample) ? sample : undefined
  }
}

const hooks: ArrangeRowsHooks = {
  identityChannel: 'color',
  unlistedRowsSort: 'source',
  rowAlias: undefined,
}
const none = { domain: [], labels: {}, rowColors: new Map<string, string>() }
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
  const haplotypes = ['HG001', 'HG002', 'HG003'].flatMap(sample => [
    { name: `${sample} HP0` },
    { name: `${sample} HP1` },
  ])
  const alias = haplotypeAlias(['HG001', 'HG002', 'HG003'])

  test('a sample name places each of its haplotypes, in the order they came', () => {
    expect(
      names(orderRowsByDomain(haplotypes, ['HG003', 'HG002 HP1'], alias)),
    ).toEqual([
      'HG003 HP0',
      'HG003 HP1',
      'HG002 HP1',
      'HG001 HP0',
      'HG001 HP1',
      'HG002 HP0',
    ])
  })

  test('an order that moves nothing hands back the rows', () => {
    expect(orderRowsByDomain(haplotypes, ['HG001'], alias)).toBe(haplotypes)
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
          rowColors: new Map([['a', 'red']]),
        },
        hooks,
      ),
    ).toBe(rows)
  })

  test('a label replaces the row label, a colour lands on the channel', () => {
    const out = arrangeRows(
      rows,
      {
        domain: ['c'],
        labels: { a: 'Ay' },
        rowColors: new Map([['b', 'blue']]),
      },
      { ...hooks, identityChannel: 'labelColor' },
    )
    expect(out).toEqual([
      { name: 'c' },
      { name: 'a', color: 'red', label: 'Ay' },
      { name: 'b', label: 'Bee', labelColor: 'blue' },
    ])
    expect(out[0]).toBe(rows[2])
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

  test('a label or colour by row name, then by its alias', () => {
    const haplotypes = ['HG001', 'HG002'].flatMap(sample => [
      { name: `${sample} HP0` },
      { name: `${sample} HP1` },
    ])
    const out = arrangeRows(
      haplotypes,
      {
        domain: [],
        labels: { 'HG001 HP1': 'One, second', HG002: 'Second' },
        rowColors: new Map([
          ['HG001', 'blue'],
          ['HG002 HP0', 'green'],
        ]),
      },
      {
        identityChannel: 'labelColor',
        unlistedRowsSort: 'source',
        rowAlias: haplotypeAlias(['HG001', 'HG002']),
      },
    )
    expect(out).toEqual([
      { name: 'HG001 HP0', labelColor: 'blue' },
      { name: 'HG001 HP1', label: 'One, second', labelColor: 'blue' },
      { name: 'HG002 HP0', label: 'Second', labelColor: 'green' },
      { name: 'HG002 HP1', label: 'Second' },
    ])
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
  const samples = [{ name: 'HG001' }, { name: 'HG002' }, { name: 'HG003' }]
  const haplotypes = ['HG001', 'HG002'].flatMap(sample => [
    { name: `${sample} HP0` },
    { name: `${sample} HP1` },
  ])
  const alias = haplotypeAlias(['HG001', 'HG002', 'HG003'])

  test('a focus on a haplotype keeps its sample, for the fetch', () => {
    expect(names(keptRows(samples, ['HG002 HP1'], alias))).toEqual(['HG002'])
  })

  test('and only that haplotype among the rows drawn', () => {
    expect(names(keptRows(haplotypes, ['HG002 HP1'], alias))).toEqual([
      'HG002 HP1',
    ])
  })

  test('a sample name keeps all of its haplotypes', () => {
    expect(names(keptRows(haplotypes, ['HG001'], alias))).toEqual([
      'HG001 HP0',
      'HG001 HP1',
    ])
  })

  test('a focus naming no current row keeps every row', () => {
    expect(keptRows(samples, ['NA0001'], alias)).toBe(samples)
    expect(keptRows(samples, undefined, alias)).toBe(samples)
  })
})
