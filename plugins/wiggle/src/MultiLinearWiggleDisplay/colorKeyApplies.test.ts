import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { WiggleSourceData } from '../util.ts'

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

// Unchanged: overlay collapses every source onto one plot, so a key is the only
// identification there has ever been, whatever the row height would have been.
it('applies in overlay mode regardless of row height', () => {
  const display = makeDisplay(cells(9, 9), 600)
  display.setRenderingType('multixyplot')
  expect(display.overlayLegendApplies).toBe(true)
})

it('never applies to a single source', () => {
  const display = makeDisplay(cells(1, 1), 620)
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
