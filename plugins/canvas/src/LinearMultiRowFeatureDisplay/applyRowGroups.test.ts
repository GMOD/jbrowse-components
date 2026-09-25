import { applyRowGroups } from './rowSources.ts'

const WOLF = { match: '^CLUP', group: 'Wolf', color: 'rgb(27,120,55)' }
const VILLAGE = {
  match: '^VILL',
  group: 'Village dog',
  color: 'rgb(90,174,97)',
}

describe('applyRowGroups', () => {
  it('tags a matching row with the entry group and swatch color', () => {
    expect(applyRowGroups([{ name: 'CLUPGR000001' }], [WOLF])).toEqual([
      { name: 'CLUPGR000001', group: 'Wolf', labelColor: 'rgb(27,120,55)' },
    ])
  })

  it('leaves an unmatched row untouched, so the majority group draws no ink', () => {
    expect(applyRowGroups([{ name: 'COLL000001' }], [WOLF, VILLAGE])).toEqual([
      { name: 'COLL000001' },
    ])
  })

  it('takes the first matching entry when several match', () => {
    const broad = { match: '^C', group: 'Broad', color: 'red' }
    const [row] = applyRowGroups([{ name: 'CLUPGR000001' }], [WOLF, broad])
    expect(row?.group).toBe('Wolf')
  })

  it('never touches color, so an itemRgb painting survives', () => {
    const [row] = applyRowGroups(
      [{ name: 'CLUPGR000001', color: 'rgb(1,2,3)' }],
      [WOLF],
    )
    expect(row?.color).toBe('rgb(1,2,3)')
    expect(row?.labelColor).toBe('rgb(27,120,55)')
  })

  it('keeps an explicitly set labelColor but still joins the group', () => {
    const [row] = applyRowGroups(
      [{ name: 'CLUPGR000001', labelColor: 'rebeccapurple' }],
      [WOLF],
    )
    expect(row?.labelColor).toBe('rebeccapurple')
    expect(row?.group).toBe('Wolf')
  })

  it('costs only its own stripe when a pattern is not a valid regex', () => {
    const bad = { match: '([', group: 'Bad', color: 'red' }
    expect(applyRowGroups([{ name: 'CLUPGR000001' }], [bad, WOLF])).toEqual([
      { name: 'CLUPGR000001', group: 'Wolf', labelColor: 'rgb(27,120,55)' },
    ])
  })

  it('returns the input unchanged when no entries are configured', () => {
    const sources = [{ name: 'a' }]
    expect(applyRowGroups(sources, [])).toBe(sources)
  })

  it('leaves the incoming order alone, interleaved groups and all', () => {
    const incoming = [
      { name: 'COLL000001' },
      { name: 'CLUPGR000001' },
      { name: 'VILLCN000001' },
      { name: 'CLUPRU000001' },
    ]
    const rows = applyRowGroups(incoming, [WOLF, VILLAGE])
    expect(rows.map(r => r.name)).toEqual(incoming.map(r => r.name))
    expect(rows.map(r => r.group)).toEqual([
      undefined,
      'Wolf',
      'Village dog',
      'Wolf',
    ])
  })
})
