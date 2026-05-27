import { set1 as overlayColors } from '@jbrowse/core/ui/colors'

import {
  buildEditableSources,
  buildSources,
  pickColor,
} from './sourcesLogic.ts'

import type { Source, SourceInfo } from '../util.ts'

const adapter = (count: number): SourceInfo[] =>
  Array.from({ length: count }, (_, i) => ({ name: `source_${i}` }))

describe('pickColor', () => {
  it('returns the explicit color whenever one is set', () => {
    expect(pickColor(0, true, '#abc')).toBe('#abc')
    expect(pickColor(0, false, '#abc')).toBe('#abc')
  })

  it('synthesizes only in overlay mode', () => {
    expect(pickColor(2, true, undefined)).toBe(overlayColors[2])
    expect(pickColor(2, false, undefined)).toBeUndefined()
  })

  it('wraps the palette modulo palette length', () => {
    const i = overlayColors.length + 3
    expect(pickColor(i, true, undefined)).toBe(overlayColors[3])
  })
})

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
})
