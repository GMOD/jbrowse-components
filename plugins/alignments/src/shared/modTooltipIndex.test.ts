import { buildModTooltipIndex, modTooltipEntriesAt } from './modTooltipIndex.ts'

import type { ModificationEntry } from './webglRpcTypes.ts'

function mod(overrides: Partial<ModificationEntry> = {}): ModificationEntry {
  return {
    readIndex: 0,
    position: 100,
    base: 'C',
    modType: 'm',
    strand: 1,
    color: 0xff0000ff,
    prob: 0.9,
    ...overrides,
  }
}

// The pair the display actually uses: build in the worker, read one position on
// the main thread. Asserting through `modTooltipEntriesAt` rather than over the
// arrays keeps these tests about the aggregation rather than about the CSR
// layout, which is free to change.
function entriesAt(modifications: ModificationEntry[], regionStart: number) {
  const index = buildModTooltipIndex({ modifications, regionStart })
  return (position: number) =>
    index ? modTooltipEntriesAt(index, position) : undefined
}

describe('buildModTooltipIndex', () => {
  it('returns undefined for no modifications', () => {
    expect(buildModTooltipIndex({ modifications: [], regionStart: 0 })).toBe(
      undefined,
    )
  })

  it('aggregates same position+type+noMod+color into one entry', () => {
    const at = entriesAt(
      [mod({ strand: 1, prob: 0.8 }), mod({ strand: -1, prob: 0.6 })],
      0,
    )
    const entries = at(100)!
    expect(entries).toHaveLength(1)
    expect(entries[0]!.count).toBe(2)
    expect(entries[0]!.fwd).toBe(1)
    expect(entries[0]!.rev).toBe(1)
    expect(entries[0]!.probabilityTotal).toBeCloseTo(1.4)
    expect(entries[0]!.name).toBe('5mC')
    expect(entries[0]!.color).toMatch(/^rgb\(/)
  })

  it('keeps entries with differing color separate at the same position', () => {
    const at = entriesAt(
      [mod({ color: 0xff0000ff }), mod({ color: 0xff00ff00 })],
      0,
    )
    expect(at(100)).toHaveLength(2)
  })

  it('separates the no-mod bucket and labels it "Unmodified <base>"', () => {
    const at = entriesAt([mod(), mod({ noMod: true })], 0)
    const entries = at(100)!
    expect(entries).toHaveLength(2)
    expect(entries.map(e => e.name).sort()).toEqual(['5mC', 'Unmodified C'])
  })

  it('groups by position', () => {
    const at = entriesAt([mod({ position: 100 }), mod({ position: 200 })], 0)
    expect(at(100)).toHaveLength(1)
    expect(at(200)).toHaveLength(1)
    expect(at(150)).toBe(undefined)
  })

  it('drops modifications left of regionStart', () => {
    const at = entriesAt([mod({ position: 50 }), mod({ position: 150 })], 100)
    expect(at(50)).toBe(undefined)
    expect(at(150)).toHaveLength(1)
  })

  it('finds every position, whatever order the calls arrived in', () => {
    // The binary search needs positions ascending; the calls come per read, so
    // they do not arrive that way.
    const positions = [500, 100, 900, 300, 700]
    const at = entriesAt(
      positions.map(position => mod({ position })),
      0,
    )
    for (const position of positions) {
      expect(at(position)).toHaveLength(1)
    }
    expect(at(400)).toBe(undefined)
    expect(at(1000)).toBe(undefined)
    expect(at(0)).toBe(undefined)
  })

  it('keeps a position’s rows in arrival order', () => {
    const at = entriesAt(
      [mod({ noMod: true, color: 0xff888888 }), mod({ color: 0xff0000ff })],
      0,
    )
    expect(at(100)!.map(e => e.name)).toEqual(['Unmodified C', '5mC'])
  })
})

describe('modTooltipEntriesAt', () => {
  it('answers undefined when the fields are absent', () => {
    expect(modTooltipEntriesAt({}, 100)).toBe(undefined)
  })
})
