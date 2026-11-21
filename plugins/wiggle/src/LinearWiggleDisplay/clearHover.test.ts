import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { WiggleHoveredFeature } from '../util.ts'

// The plot is a painted canvas with nothing travelling with its features, so
// when the content moves under a stationary cursor the browser fires neither
// mousemove nor mouseleave — the model has to drop the hover itself, or the
// tooltip keeps reporting the bp and score the cursor *was* over. Both axes are
// pinned because a locstring or side-scroll pan moves offsetPx without touching
// bpPerPx, which is exactly the case a zoom-only guard misses.
const hover: WiggleHoveredFeature = {
  refName: 'ctgA',
  start: 100,
  end: 101,
  rows: [{ score: 42 }],
}

describe('LinearWiggleDisplay clears its hover when the content moves', () => {
  it('clears on a pan that changes offsetPx alone', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setHoveredFeature(hover)
    expect(display.hoveredFeature).toBeDefined()

    view.scrollTo(view.offsetPx + 100)

    expect(display.hoveredFeature).toBeUndefined()
  })

  it('clears on a zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setHoveredFeature(hover)
    expect(display.hoveredFeature).toBeDefined()

    view.zoomTo(view.bpPerPx * 2)

    expect(display.hoveredFeature).toBeUndefined()
  })

  it('leaves the hover alone while the viewport is still', () => {
    // the reaction skips its initial run, so merely setting a hover must not
    // clear it — as an autorun reading hover state it would have
    const { display } = createTestEnvironment().createDisplay()
    display.setHoveredFeature(hover)
    expect(display.hoveredFeature).toBeDefined()
  })

  // a hover names the row it was read from, so a clustering run or a sort
  // landing under a still pointer would name a row no longer under it
  it('clears on a row reorder, and keeps the hover on a relabel', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setRowLayout(true)
    display.setRpcData(
      0,
      { sources: [makeSource('a'), makeSource('b')] },
      view.displayedRegions[0],
    )
    const rowHover: WiggleHoveredFeature = {
      ...hover,
      rows: [{ source: 'a', score: 42 }],
    }
    display.setHoveredFeature(rowHover)

    display.applyRowEdits(
      display.arrangedRows.map((s, i) =>
        i === 0 ? { ...s, label: 'Renamed' } : s,
      ),
    )
    expect(display.hoveredFeature).toEqual(rowHover)

    display.setRowOrder([{ name: 'b' }, { name: 'a' }])
    expect(display.drawnRows.map(r => r.name)).toEqual(['b', 'a'])
    expect(display.hoveredFeature).toBeUndefined()
  })
})
