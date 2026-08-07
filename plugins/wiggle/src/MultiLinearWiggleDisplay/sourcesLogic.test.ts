import { set1 as overlayColors } from '@jbrowse/core/ui/colors'
import { reconcileLayout } from '@jbrowse/tree-sidebar'

import { buildSources } from './sourcesLogic.ts'

import type { SourceInfo } from '../util.ts'

const adapter = (count: number): SourceInfo[] =>
  Array.from({ length: count }, (_, i) => ({ name: `source_${i}` }))

// `reconcileLayout` stands in for the display's `editableSources` getter, which
// is now just that call. Its own membership rules — layout order wins, dropped
// rows, newly-discovered rows appended — are tree-sidebar's and are tested in
// clusterUtils.test.ts; what's left here is the color synthesis that is wiggle's.

describe('buildSources', () => {
  it('synthesizes overlay palette only in overlay mode', () => {
    const editable = reconcileLayout(adapter(3), [])
    const overlay = buildSources(editable, undefined, true, false)
    expect(overlay.map(s => s.color)).toEqual([
      overlayColors[0],
      overlayColors[1],
      overlayColors[2],
    ])
    const rows = buildSources(editable, undefined, false, false)
    expect(rows.every(s => s.color === undefined)).toBe(true)
  })

  it('preserves explicit colors over palette synthesis in overlay mode', () => {
    const editable = reconcileLayout(
      [
        { name: 'a', color: '#ff0000' },
        { name: 'b' },
        { name: 'c', color: '#00ff00' },
      ],
      [],
    )
    const out = buildSources(editable, undefined, true, false)
    expect(out[0]!.color).toBe('#ff0000')
    expect(out[1]!.color).toBe(overlayColors[1])
    expect(out[2]!.color).toBe('#00ff00')
  })

  it('wraps the overlay palette modulo palette length', () => {
    const n = overlayColors.length
    const out = buildSources(
      reconcileLayout(adapter(n + 2), []),
      undefined,
      true,
      false,
    )
    expect(out[n]!.color).toBe(overlayColors[0])
    expect(out[n + 1]!.color).toBe(overlayColors[1])
  })

  it('keeps each overlay palette color across a subtree filter', () => {
    const editable = reconcileLayout(adapter(12), [])
    const unfiltered = buildSources(editable, undefined, true, false)
    const out = buildSources(editable, ['source_0', 'source_5'], true, false)
    expect(out.map(s => s.name)).toEqual(['source_0', 'source_5'])
    expect(out[0]!.color).toBe(unfiltered[0]!.color)
    expect(out[1]!.color).toBe(unfiltered[5]!.color)
  })

  it('keeps each group color across a subtree filter', () => {
    const editable = reconcileLayout(
      [
        { name: 'a', group: 'g1' },
        { name: 'b', group: 'g2' },
        { name: 'c', group: 'g3' },
      ],
      [],
    )
    const unfiltered = buildSources(editable, undefined, false, false)
    const out = buildSources(editable, ['c'], false, false)
    expect(out[0]!.color).toBe(unfiltered[2]!.color)
  })

  it('layout color survives through to sources view', () => {
    const editable = reconcileLayout<SourceInfo>(
      [{ name: 'a' }, { name: 'b' }],
      [{ name: 'a', color: '#0000ff' }, { name: 'b' }],
    )
    const out = buildSources(editable, undefined, false, false)
    expect(out[0]!.color).toBe('#0000ff')
    expect(out[1]!.color).toBeUndefined()
  })

  it('layout color survives through overlay synthesis too', () => {
    const editable = reconcileLayout<SourceInfo>(
      [{ name: 'a' }, { name: 'b' }],
      [{ name: 'a', color: '#0000ff' }, { name: 'b' }],
    )
    const out = buildSources(editable, undefined, true, false)
    expect(out[0]!.color).toBe('#0000ff')
    // 'b' had no explicit color, so palette synthesizes by its index
    expect(out[1]!.color).toBe(overlayColors[1])
  })

  it('assigns same color to sources sharing a group, in both row and overlay mode', () => {
    const editable = reconcileLayout(
      [
        { name: 'a', group: 'tumor' },
        { name: 'b', group: 'normal' },
        { name: 'c', group: 'tumor' },
      ],
      [],
    )
    for (const isOverlay of [false, true]) {
      const out = buildSources(editable, undefined, isOverlay, false)
      // 'a' and 'c' share 'tumor' → same color
      expect(out[0]!.color).toBe(out[2]!.color)
      // 'b' is 'normal' → different color from 'tumor'
      expect(out[1]!.color).not.toBe(out[0]!.color)
    }
  })

  it('explicit color takes priority over group color', () => {
    const editable = reconcileLayout(
      [{ name: 'a', color: '#ff0000', group: 'tumor' }],
      [],
    )
    const out = buildSources(editable, undefined, false, false)
    expect(out[0]!.color).toBe('#ff0000')
  })

  // In density `color` IS the score ramp, so a group's identity hue there would
  // replace the pos/neg scale rather than sit beside it. It goes to the row
  // label instead, matching where the Set Color dialog writes in this mode.
  it('routes a group color to labelColor in density mode, leaving the ramp alone', () => {
    const editable = reconcileLayout(
      [
        { name: 'a', group: 'PUR' },
        { name: 'b', group: 'YRI' },
        { name: 'c', group: 'PUR' },
      ],
      [],
    )
    const out = buildSources(editable, undefined, false, true)
    for (const s of out) {
      expect(s.color).toBeUndefined()
    }
    expect(out[0]!.labelColor).toBe(out[2]!.labelColor)
    expect(out[1]!.labelColor).not.toBe(out[0]!.labelColor)
  })

  it('keeps an explicitly set color in density mode', () => {
    const editable = reconcileLayout(
      [{ name: 'a', color: '#ff0000', group: 'PUR' }],
      [],
    )
    const out = buildSources(editable, undefined, false, true)
    expect(out[0]!.color).toBe('#ff0000')
    expect(out[0]!.labelColor).toBeDefined()
  })

  // The row label is the key to the rows, so where the source ships its own
  // color -- which is what the density ramp paints the row with -- the label has
  // to be that color rather than the group palette's entry for its group.
  it('labels a density row with the source color rather than the group palette', () => {
    const editable = reconcileLayout(
      [
        { name: 'a', color: '#8c564b', group: 'Monocyte' },
        { name: 'b', color: '#e377c2', group: 'Monocyte' },
        { name: 'c', group: 'Platelet' },
      ],
      [],
    )
    const out = buildSources(editable, undefined, false, true)
    expect(out[0]!.labelColor).toBe('#8c564b')
    // two cell types inside one group keep their own colors rather than
    // collapsing to the group's
    expect(out[1]!.labelColor).toBe('#e377c2')
    // no color of its own, so the group palette still fills it in
    expect(out[2]!.labelColor).toBe(overlayColors[1])
  })

  it('keeps an explicitly set labelColor over the group color', () => {
    const editable = reconcileLayout(
      [{ name: 'a', labelColor: '#00ff00', group: 'PUR' }],
      [],
    )
    const out = buildSources(editable, undefined, false, true)
    expect(out[0]!.labelColor).toBe('#00ff00')
  })
})
