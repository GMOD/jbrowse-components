import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { WiggleSourceData } from '@jbrowse/wiggle-core'

// One source per cell, grouped and coloured the way a per-cell signal store
// ships them: many rows, few groups, one colour per group.
function cells(n: number, groups: number): WiggleSourceData[] {
  return Array.from({ length: n }, (_, i) => ({
    ...makeSource(`cell${i}`),
    group: `g${i % groups}`,
    color: `#${(i % groups).toString(16).repeat(6)}`,
  }))
}

function makeDisplay(sources: WiggleSourceData[], height: number) {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setHeight(height)
  display.setRpcData(0, { sources })
  return display
}

// The multi-row default: rows tall enough for SvgRowLabels to draw text, so the
// sidebar already names every colour and a key beside it would restate it.
it('does not apply to a multi-row track whose rows can carry their labels', () => {
  const display = makeDisplay(cells(9, 9), 600)
  expect(display.effectiveRowHeight).toBeGreaterThanOrEqual(6)
  expect(display.overlayLegendApplies).toBe(false)
})

// Hiding the dendrogram does not hide the row labels — those are
// MultiWiggleSvgScales' own and draw for every multi-row track — so the key
// would restate names still on screen. Row height is the whole test.
it('does not apply to a labellable multi-row track with the tree hidden', () => {
  const display = makeDisplay(cells(9, 9), 600)
  display.setShowTree(false)
  expect(display.overlayLegendApplies).toBe(false)
})

// The case this was widened for: 4,390 cells over 620px is 0.14px a row, where
// SvgRowLabels drops to an unlabelled colour swatch. Nothing else on the frame
// names the colours, so the key is the only identification there is.
it('applies to a multi-row track whose rows are below the label threshold', () => {
  const display = makeDisplay(cells(4390, 9), 620)
  expect(display.effectiveRowHeight).toBeLessThan(6)
  expect(display.overlayLegendApplies).toBe(true)
})

// The collapse is what makes that legal: the key is one row per (group, colour)
// pair, not one per source. A track whose sources carry no group cannot
// collapse, so the key would be 4,390 rows and is not drawn.
it('does not apply when the sources cannot collapse into a short key', () => {
  const ungrouped = Array.from({ length: 4390 }, (_, i) => ({
    ...makeSource(`cell${i}`),
    color: `#${i.toString(16).padStart(6, '0')}`,
  })) as WiggleSourceData[]
  const display = makeDisplay(ungrouped, 620)
  expect(display.overlayLegendApplies).toBe(false)
})

// Overlay collapses every source onto one plot, so a key is the only
// identification there has ever been, whatever the row height would have been.
it('applies in overlay mode regardless of row height', () => {
  const display = makeDisplay(cells(9, 9), 600)
  display.setRenderingType('multixyplot')
  expect(display.overlayLegendApplies).toBe(true)
})

// Overlay is not exempt from the readability bar. Its row palette is `set1`,
// which wraps every nine sources, so 40 ungrouped overlay rows are a 40-row key
// in nine repeating colours — longer than anyone can scan and ambiguous where
// it wraps.
it('does not apply in overlay mode when the key is longer than it is readable', () => {
  const display = makeDisplay(
    Array.from({ length: 40 }, (_, i) => makeSource(`cell${i}`)),
    600,
  )
  display.setRenderingType('multixyplot')
  expect(display.legendItems).toHaveLength(40)
  expect(display.overlayLegendApplies).toBe(false)
})

// The same 40 sources in four groups collapse to a four-row key, which is what
// the length bar is asking about — the row count was never the question.
it('applies in overlay mode when the same sources collapse into a short key', () => {
  const display = makeDisplay(cells(40, 4), 600)
  display.setRenderingType('multixyplot')
  expect(display.legendItems).toHaveLength(4)
  expect(display.overlayLegendApplies).toBe(true)
})

it('never applies to a single source', () => {
  const display = makeDisplay(cells(1, 1), 620)
  expect(display.overlayLegendApplies).toBe(false)
})

// Density spends `color` on the score ramp, so a row's identity colour is its
// `labelColor` — which is where a grouped-but-uncoloured cohort's group palette
// lands. The key has to draw the colour the rows actually are.
describe('density mode keys off the row identity colour', () => {
  // no `color` of their own, which is what a MultiWiggleAdapter that sets
  // `group` and nothing else produces
  function groupedUncoloured(n: number, groups: number) {
    return Array.from({ length: n }, (_, i) => ({
      ...makeSource(`cell${i}`),
      group: `g${i % groups}`,
    })) as WiggleSourceData[]
  }

  it('draws the swatches the rows are tinted with, not the pos colour', () => {
    const display = makeDisplay(groupedUncoloured(4390, 4), 620)
    display.setRenderingType('multirowdensity')
    // the ramp still owns `color`; identity moved to labelColor
    expect(display.sources.every(s => !s.color)).toBe(true)
    const colors = display.legendItems.map(i => i.color)
    expect(new Set(colors).size).toBe(4)
    expect(colors[0]).toBe(display.sources[0]!.labelColor)
    expect(display.overlayLegendApplies).toBe(true)
  })

  // Nothing carries an identity colour, and in density there is no fallback to
  // invent one: `posColor` is the score ramp, so keying a row with it points at
  // a colour every row on the plot is already drawn on. SvgRowLabels draws no
  // swatch for such a row either, so the key drawing no entry matches it.
  // Sized so the entry count alone would let a key through (20 rows at 5px is
  // under both the label threshold and MAX_LEGEND_ITEMS).
  it('keys nothing when no row carries an identity colour', () => {
    const display = makeDisplay(
      Array.from({ length: 20 }, (_, i) => makeSource(`cell${i}`)),
      100,
    )
    display.setRenderingType('multirowdensity')
    expect(display.effectiveRowHeight).toBeLessThan(6)
    expect(display.legendItems).toHaveLength(0)
    expect(display.overlayLegendApplies).toBe(false)
  })

  // The mixed track: grouped subtracks always take a group palette entry, so
  // they key; ungrouped ones take none and have no identity colour at all. They
  // used to key in `posColor` — the ramp — which put swatches in the key for
  // rows whose label boxes are the plain theme background.
  it('keys the grouped rows and leaves the uncoloured ones out', () => {
    const display = makeDisplay(
      [
        ...groupedUncoloured(6, 3),
        ...Array.from({ length: 2 }, (_, i) => makeSource(`ref${i}`)),
      ] as WiggleSourceData[],
      40,
    )
    display.setRenderingType('multirowdensity')
    expect(display.sources.filter(s => !s.labelColor)).toHaveLength(2)
    expect(display.legendItems.map(i => i.label)).toEqual(['g0', 'g1', 'g2'])
    expect(display.legendItems.every(i => i.color !== display.posColor)).toBe(
      true,
    )
  })
})

// The other side of the same rule: outside density an unset `color` really is
// what `buildSourceRenderData` paints in `posColor`, so the key resolves to it
// rather than dropping the row — and a whole key collapsing to that one colour
// is what `legendIsReadable` is left to refuse.
it('keys uncoloured multi-row rows in the colour they are painted', () => {
  const display = makeDisplay(
    Array.from({ length: 20 }, (_, i) => makeSource(`cell${i}`)),
    100,
  )
  expect(display.legendItems).toHaveLength(20)
  expect(display.legendItems.every(i => i.color === display.posColor)).toBe(
    true,
  )
  expect(display.overlayLegendApplies).toBe(false)
})

// A group whose sources disagree about their colour still collapses, to one row
// per colour within it, which is how a store with a coarser grouping than its
// colouring gets a key at all: six lineages coloured by nine cell types is nine
// rows and not 4,390.
it('applies when a group splits by colour but the key stays short', () => {
  const lineages = ['T', 'T', 'Mono', 'Mono', 'B', 'NK', 'DC', 'DC', 'Plt']
  const split = Array.from({ length: 4390 }, (_, i) => ({
    ...makeSource(`cell${i}`),
    group: lineages[i % lineages.length]!,
    color: `#${(i % lineages.length).toString(16).repeat(6)}`,
  })) as WiggleSourceData[]
  const display = makeDisplay(split, 620)
  expect(display.overlayLegendApplies).toBe(true)
})
