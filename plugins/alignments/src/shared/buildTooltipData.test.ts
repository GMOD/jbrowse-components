import { buildModTooltipData } from './buildTooltipData.ts'

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

describe('buildModTooltipData', () => {
  it('returns undefined for no modifications', () => {
    expect(buildModTooltipData({ modifications: [], regionStart: 0 })).toBe(
      undefined,
    )
  })

  it('aggregates same position+type+noMod+color into one entry', () => {
    const result = buildModTooltipData({
      modifications: [
        mod({ strand: 1, prob: 0.8 }),
        mod({ strand: -1, prob: 0.6 }),
      ],
      regionStart: 0,
    })
    const entries = result![100]!
    expect(entries).toHaveLength(1)
    expect(entries[0]!.count).toBe(2)
    expect(entries[0]!.fwd).toBe(1)
    expect(entries[0]!.rev).toBe(1)
    expect(entries[0]!.probabilityTotal).toBeCloseTo(1.4)
    expect(entries[0]!.name).toBe('5mC')
    expect(entries[0]!.color).toMatch(/^rgb\(/)
  })

  it('keeps entries with differing color separate at the same position', () => {
    const result = buildModTooltipData({
      modifications: [mod({ color: 0xff0000ff }), mod({ color: 0xff00ff00 })],
      regionStart: 0,
    })
    expect(result![100]).toHaveLength(2)
  })

  it('separates the no-mod bucket and labels it "Unmodified <base>"', () => {
    const result = buildModTooltipData({
      modifications: [mod(), mod({ noMod: true })],
      regionStart: 0,
    })
    const entries = result![100]!
    expect(entries).toHaveLength(2)
    expect(entries.map(e => e.name).sort()).toEqual(['5mC', 'Unmodified C'])
  })

  it('groups by position', () => {
    const result = buildModTooltipData({
      modifications: [mod({ position: 100 }), mod({ position: 200 })],
      regionStart: 0,
    })
    expect(Object.keys(result!).sort()).toEqual(['100', '200'])
  })

  it('drops modifications left of regionStart', () => {
    const result = buildModTooltipData({
      modifications: [mod({ position: 50 }), mod({ position: 150 })],
      regionStart: 100,
    })
    expect(result![50]).toBe(undefined)
    expect(result![150]).toHaveLength(1)
  })
})
