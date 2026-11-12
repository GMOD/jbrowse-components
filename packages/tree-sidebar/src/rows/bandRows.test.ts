import { bandRows } from './bandRows.ts'

const names = (rows: { name: string }[]) => rows.map(r => r.name)

describe('bandRows', () => {
  const pop = (row: { pop?: string }) => row.pop ?? ''
  const band = (
    rows: { name: string; pop?: string }[],
    domain: string[] = [],
  ) => bandRows(rows, pop, { field: 'pop', sort: domain })
  const samples = [
    { name: 's1', pop: 'EUR' },
    { name: 's2', pop: 'AFR' },
    { name: 's3', pop: 'EUR' },
    { name: 's4', pop: 'AFR' },
    { name: 's5', pop: 'AFR' },
  ]

  test('stacks each band contiguous, in sorted value order, arranged within', () => {
    const { rows, bands } = band(samples)
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
    expect(names(band(samples, ['EUR']).rows)).toEqual([
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
