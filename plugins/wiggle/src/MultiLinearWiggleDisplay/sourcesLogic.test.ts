import { set1 as overlayColors } from '@jbrowse/core/ui/colors'

import { buildEditableSources, buildSources } from './sourcesLogic.ts'

import type { Source, SourceInfo } from '../util.ts'

const adapter = (count: number): SourceInfo[] =>
  Array.from({ length: count }, (_, i) => ({ name: `source_${i}` }))

describe('buildEditableSources', () => {
  it('returns adapter order when no layout', () => {
    const out = buildEditableSources(adapter(3), [])
    expect(out.map(s => s.name)).toEqual(['source_0', 'source_1', 'source_2'])
    expect(out.map(s => s.source)).toEqual(['source_0', 'source_1', 'source_2'])
  })

  it('orders by layout when layout is set, merging adapter fields', () => {
    const adapters: SourceInfo[] = [
      { name: 'a', label: 'first', color: '#aaa' },
      { name: 'b', label: 'second' },
    ]
    const layout: Source[] = [
      { source: 'b', name: 'b', color: '#bbb' },
      { source: 'a', name: 'a' },
    ]
    const out = buildEditableSources(adapters, layout)
    expect(out.map(s => s.name)).toEqual(['b', 'a'])
    expect(out.map(s => s.source)).toEqual(['b', 'a'])
    // Layout color wins
    expect(out[0]!.color).toBe('#bbb')
    // Adapter color flows through when layout doesn't override
    expect(out[1]!.color).toBe('#aaa')
    // Adapter `label` survives merge for both rows
    expect(out[0]!.label).toBe('second')
    expect(out[1]!.label).toBe('first')
  })

  it('does not synthesize overlay colors', () => {
    const out = buildEditableSources(adapter(5), [])
    for (const s of out) {
      expect(s.color).toBeUndefined()
    }
  })

  it('appends adapter sources added after the layout was saved', () => {
    const layout: Source[] = [
      { source: 'source_1', name: 'source_1' },
      { source: 'source_0', name: 'source_0' },
    ]
    // adapter now has a third source that the saved layout never saw
    const out = buildEditableSources(adapter(3), layout)
    expect(out.map(s => s.name)).toEqual(['source_1', 'source_0', 'source_2'])
  })

  it('drops layout entries whose source no longer exists in the adapter', () => {
    const layout: Source[] = [
      { source: 'source_1', name: 'source_1' },
      { source: 'ghost', name: 'ghost' },
      { source: 'source_0', name: 'source_0' },
    ]
    const out = buildEditableSources(adapter(2), layout)
    expect(out.map(s => s.name)).toEqual(['source_1', 'source_0'])
  })
})

describe('buildSources', () => {
  it('synthesizes overlay palette only in overlay mode', () => {
    const editable = buildEditableSources(adapter(3), [])
    const overlay = buildSources(editable, undefined, true)
    expect(overlay.map(s => s.color)).toEqual([
      overlayColors[0],
      overlayColors[1],
      overlayColors[2],
    ])
    const rows = buildSources(editable, undefined, false)
    expect(rows.every(s => s.color === undefined)).toBe(true)
  })

  it('preserves explicit colors over palette synthesis in overlay mode', () => {
    const editable = buildEditableSources(
      [
        { name: 'a', color: '#ff0000' },
        { name: 'b' },
        { name: 'c', color: '#00ff00' },
      ],
      [],
    )
    const out = buildSources(editable, undefined, true)
    expect(out[0]!.color).toBe('#ff0000')
    expect(out[1]!.color).toBe(overlayColors[1])
    expect(out[2]!.color).toBe('#00ff00')
  })

  it('wraps the overlay palette modulo palette length', () => {
    const n = overlayColors.length
    const out = buildSources(buildEditableSources(adapter(n + 2), []), undefined, true)
    expect(out[n]!.color).toBe(overlayColors[0])
    expect(out[n + 1]!.color).toBe(overlayColors[1])
  })

  it('re-indexes overlay palette after subtree filter', () => {
    const editable = buildEditableSources(adapter(12), [])
    const out = buildSources(editable, ['source_0', 'source_5'], true)
    expect(out.map(s => s.name)).toEqual(['source_0', 'source_5'])
    expect(out[0]!.color).toBe(overlayColors[0])
    expect(out[1]!.color).toBe(overlayColors[1])
  })

  it('layout color survives through to sources view', () => {
    const editable = buildEditableSources(
      [{ name: 'a' }, { name: 'b' }],
      [
        { source: 'a', name: 'a', color: '#0000ff' },
        { source: 'b', name: 'b' },
      ],
    )
    const out = buildSources(editable, undefined, false)
    expect(out[0]!.color).toBe('#0000ff')
    expect(out[1]!.color).toBeUndefined()
  })

  it('layout color survives through overlay synthesis too', () => {
    const editable = buildEditableSources(
      [{ name: 'a' }, { name: 'b' }],
      [
        { source: 'a', name: 'a', color: '#0000ff' },
        { source: 'b', name: 'b' },
      ],
    )
    const out = buildSources(editable, undefined, true)
    expect(out[0]!.color).toBe('#0000ff')
    // 'b' had no explicit color, so palette synthesizes by its index
    expect(out[1]!.color).toBe(overlayColors[1])
  })

  it('assigns same color to sources sharing a group, in both row and overlay mode', () => {
    const editable = buildEditableSources(
      [
        { name: 'a', group: 'tumor' },
        { name: 'b', group: 'normal' },
        { name: 'c', group: 'tumor' },
      ],
      [],
    )
    for (const isOverlay of [false, true]) {
      const out = buildSources(editable, undefined, isOverlay)
      // 'a' and 'c' share 'tumor' → same color
      expect(out[0]!.color).toBe(out[2]!.color)
      // 'b' is 'normal' → different color from 'tumor'
      expect(out[1]!.color).not.toBe(out[0]!.color)
    }
  })

  it('explicit color takes priority over group color', () => {
    const editable = buildEditableSources(
      [{ name: 'a', color: '#ff0000', group: 'tumor' }],
      [],
    )
    const out = buildSources(editable, undefined, false)
    expect(out[0]!.color).toBe('#ff0000')
  })
})
