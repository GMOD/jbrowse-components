import { compileRowGroups, tagRowGroups } from './rowSources.ts'

import type { RowGroup } from './rowSources.ts'

const WOLF = { match: '^CLUP', group: 'Wolf' }
const VILLAGE = { match: '^VILL', group: 'Village dog' }

const tag = (rows: { name: string }[], groups: RowGroup[]) =>
  tagRowGroups(rows, compileRowGroups(groups))

describe('tagRowGroups', () => {
  it('tags a matching row with the entry group alone', () => {
    expect(tag([{ name: 'CLUPGR000001' }], [WOLF])).toEqual([
      { name: 'CLUPGR000001', group: 'Wolf' },
    ])
  })

  it('leaves an unmatched row untouched, so the majority group draws no ink', () => {
    const row = { name: 'COLL000001' }
    expect(tag([row], [WOLF, VILLAGE])[0]).toBe(row)
  })

  it('takes the first matching entry when several match', () => {
    const broad = { match: '^C', group: 'Broad' }
    expect(tag([{ name: 'CLUPGR000001' }], [WOLF, broad])[0]?.group).toBe(
      'Wolf',
    )
  })

  it('costs only its own entry when a pattern is not a valid regex', () => {
    const bad = { match: '([', group: 'Bad' }
    expect(tag([{ name: 'CLUPGR000001' }], [bad, WOLF])).toEqual([
      { name: 'CLUPGR000001', group: 'Wolf' },
    ])
  })

  it('returns the input unchanged when no entries are configured', () => {
    const rows = [{ name: 'a' }]
    expect(tag(rows, [])).toBe(rows)
  })

  it('leaves the incoming order alone, interleaved groups and all', () => {
    const incoming = [
      { name: 'COLL000001' },
      { name: 'CLUPGR000001' },
      { name: 'VILLCN000001' },
      { name: 'CLUPRU000001' },
    ]
    const rows = tag(incoming, [WOLF, VILLAGE])
    expect(rows.map(r => r.name)).toEqual(incoming.map(r => r.name))
    expect(rows.map(r => r.group)).toEqual([
      undefined,
      'Wolf',
      'Village dog',
      'Wolf',
    ])
  })
})
