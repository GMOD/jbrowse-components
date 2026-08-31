import { applyRowGroups } from './sourcesLogic.ts'

const WOLF = { match: '^CLUP', group: 'Wolf', color: 'rgb(27,120,55)' }
const VILLAGE = {
  match: '^VILL',
  group: 'Village dog',
  color: 'rgb(90,174,97)',
}

describe('applyRowGroups', () => {
  it('tags a matching row with the entry group and swatch color', () => {
    expect(
      applyRowGroups([{ name: 'CLUPGR000001' }], [WOLF], { partition: true }),
    ).toEqual([
      { name: 'CLUPGR000001', group: 'Wolf', labelColor: 'rgb(27,120,55)' },
    ])
  })

  it('leaves an unmatched row untouched, so the majority group draws no ink', () => {
    expect(
      applyRowGroups([{ name: 'COLL000001' }], [WOLF, VILLAGE], {
        partition: true,
      }),
    ).toEqual([{ name: 'COLL000001' }])
  })

  it('takes the first matching entry when several match', () => {
    const broad = { match: '^C', group: 'Broad', color: 'red' }
    const [row] = applyRowGroups([{ name: 'CLUPGR000001' }], [WOLF, broad], {
      partition: true,
    })
    expect(row?.group).toBe('Wolf')
  })

  it('never touches color, so an itemRgb painting survives', () => {
    const [row] = applyRowGroups(
      [{ name: 'CLUPGR000001', color: 'rgb(1,2,3)' }],
      [WOLF],
      { partition: true },
    )
    expect(row?.color).toBe('rgb(1,2,3)')
    expect(row?.labelColor).toBe('rgb(27,120,55)')
  })

  it('keeps an explicitly set labelColor but still joins the group', () => {
    const [row] = applyRowGroups(
      [{ name: 'CLUPGR000001', labelColor: 'rebeccapurple' }],
      [WOLF],
      { partition: true },
    )
    expect(row?.labelColor).toBe('rebeccapurple')
    expect(row?.group).toBe('Wolf')
  })

  it('a recolored row stays in its block rather than falling to the bottom', () => {
    const rows = applyRowGroups(
      [
        { name: 'COLL000001' },
        { name: 'CLUPGR000001', labelColor: 'rebeccapurple' },
        { name: 'CLUPRU000001' },
      ],
      [WOLF],
      { partition: true },
    )
    expect(rows.map(r => r.name)).toEqual([
      'CLUPGR000001',
      'CLUPRU000001',
      'COLL000001',
    ])
  })

  it('costs only its own stripe when a pattern is not a valid regex', () => {
    const bad = { match: '([', group: 'Bad', color: 'red' }
    expect(
      applyRowGroups([{ name: 'CLUPGR000001' }], [bad, WOLF], {
        partition: true,
      }),
    ).toEqual([
      { name: 'CLUPGR000001', group: 'Wolf', labelColor: 'rgb(27,120,55)' },
    ])
  })

  it('returns the input unchanged when no entries are configured', () => {
    const sources = [{ name: 'a' }]
    expect(applyRowGroups(sources, [], { partition: true })).toBe(sources)
  })

  it('pulls matched rows into one block ahead of the unmatched ones', () => {
    const rows = applyRowGroups(
      [
        { name: 'COLL000001' },
        { name: 'CLUPGR000001' },
        { name: 'DACH000001' },
        { name: 'CLUPRU000001' },
      ],
      [WOLF],
      { partition: true },
    )
    expect(rows.map(r => r.name)).toEqual([
      'CLUPGR000001',
      'CLUPRU000001',
      'COLL000001',
      'DACH000001',
    ])
  })

  it('blocks follow the order the entries are declared', () => {
    const rows = applyRowGroups(
      [
        { name: 'VILLCN000001' },
        { name: 'COLL000001' },
        { name: 'CLUP000001' },
      ],
      [WOLF, VILLAGE],
      { partition: true },
    )
    expect(rows.map(r => r.group)).toEqual(['Wolf', 'Village dog', undefined])
  })

  it('keeps the incoming order inside a block, so a sort survives grouping', () => {
    const rows = applyRowGroups(
      [
        { name: 'CLUPb' },
        { name: 'COLLx' },
        { name: 'CLUPa' },
        { name: 'COLLy' },
      ],
      [WOLF],
      { partition: true },
    )
    expect(rows.map(r => r.name)).toEqual(['CLUPb', 'CLUPa', 'COLLx', 'COLLy'])
  })

  // What the caller does when a cluster tree already names this order. Tagging
  // and ordering are separate questions and the model asks for only the first,
  // because the alternative it used to take was reordering the rows out from
  // under the dendrogram, which then silently stopped drawing.
  describe('partition: false', () => {
    it('tags every row exactly as it would otherwise', () => {
      const rows = applyRowGroups([{ name: 'CLUPGR000001' }], [WOLF], {
        partition: false,
      })
      expect(rows).toEqual([
        { name: 'CLUPGR000001', group: 'Wolf', labelColor: 'rgb(27,120,55)' },
      ])
    })

    it('leaves the incoming order alone, interleaved groups and all', () => {
      const incoming = [
        { name: 'COLL000001' },
        { name: 'CLUPGR000001' },
        { name: 'VILLCN000001' },
        { name: 'CLUPRU000001' },
      ]
      const rows = applyRowGroups(incoming, [WOLF, VILLAGE], {
        partition: false,
      })
      expect(rows.map(r => r.name)).toEqual(incoming.map(r => r.name))
      expect(rows.map(r => r.group)).toEqual([
        undefined,
        'Wolf',
        'Village dog',
        'Wolf',
      ])
    })
  })
})
