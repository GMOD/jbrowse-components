import {
  applyRowGroupColors,
  compileRowGroups,
  groupColorEntries,
  tagRowGroups,
} from './rowSources.ts'

import type { RowGroup } from './rowSources.ts'

const WOLF = { match: '^CLUP', group: 'Wolf', color: 'rgb(27,120,55)' }
const VILLAGE = {
  match: '^VILL',
  group: 'Village dog',
  color: 'rgb(90,174,97)',
}

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
    const broad = { match: '^C', group: 'Broad', color: 'red' }
    expect(tag([{ name: 'CLUPGR000001' }], [WOLF, broad])[0]?.group).toBe(
      'Wolf',
    )
  })

  it('costs only its own entry when a pattern is not a valid regex', () => {
    const bad = { match: '([', group: 'Bad', color: 'red' }
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

describe('applyRowGroupColors', () => {
  it('gives a matching row its entry colour as the swatch', () => {
    expect(
      applyRowGroupColors([{ name: 'CLUPGR000001', group: 'Wolf' }], [WOLF]),
    ).toEqual([
      { name: 'CLUPGR000001', group: 'Wolf', labelColor: 'rgb(27,120,55)' },
    ])
  })

  it('never touches color, so an itemRgb painting survives', () => {
    const [row] = applyRowGroupColors(
      [{ name: 'CLUPGR000001', color: 'rgb(1,2,3)' }],
      [WOLF],
    )
    expect(row?.color).toBe('rgb(1,2,3)')
    expect(row?.labelColor).toBe('rgb(27,120,55)')
  })

  it('keeps an explicitly set labelColor', () => {
    const row = { name: 'CLUPGR000001', labelColor: 'rebeccapurple' }
    expect(applyRowGroupColors([row], [WOLF])[0]).toBe(row)
  })

  it('returns the input unchanged when no entries are configured', () => {
    const sources = [{ name: 'a' }]
    expect(applyRowGroupColors(sources, [])).toBe(sources)
  })
})

describe('groupColorEntries', () => {
  it('adds each unlisted group its own colour, keeping the spare range', () => {
    expect(
      groupColorEntries([WOLF, VILLAGE], {
        domain: ['Wolf'],
        range: ['red', 'pink'],
      }),
    ).toEqual({
      domain: ['Wolf', 'Village dog'],
      range: ['red', 'rgb(90,174,97)', 'pink'],
    })
  })

  it('returns the entries themselves when every group is listed', () => {
    const entries = { domain: ['Wolf', 'Village dog'], range: ['a', 'b'] }
    expect(groupColorEntries([WOLF, VILLAGE], entries)).toBe(entries)
  })
})
