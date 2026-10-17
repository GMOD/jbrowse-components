import { setConf } from '@jbrowse/core/configuration'
import { treeSidebarOffset } from '@jbrowse/tree-sidebar'

import { DEFAULTS } from './displayDefaults.ts'
import { createMafTestEnvironment } from './testEnv.ts'

function setup(nSamples: number, rowHeight: number) {
  const { display } = createMafTestEnvironment().createDisplay()
  display.setSamples({
    samples: Array.from({ length: nSamples }, (_, i) => ({
      id: `s${i}`,
      label: `s${i}`,
    })),
    treeNewick: undefined,
    samplesCanonical: true,
  })
  display.setRowHeight(rowHeight)
  return display
}

test('drag tracks the cursor in both directions', () => {
  const display = setup(10, 15)
  expect(display.effectiveRowHeight).toBe(15)

  const before = display.height
  display.resizeHeight(+100)
  expect(display.height - before).toBeCloseTo(100)

  const mid = display.height
  display.resizeHeight(-60)
  expect(display.height - mid).toBeCloseTo(-60)
})

// A pinned row height is the size the user asked to read at, so it survives
// however many species there are: the rows canvas is the viewport, and the rows
// that don't fit are scrolled to rather than shrunk or grown into.
describe('a pinned row height scrolls rather than resizing the canvas', () => {
  // 1000 species at 15px = 15000px of rows behind the default track.
  const deep = () => setup(1000, 15)

  it('honors the pinned height and scrolls the overflow', () => {
    const display = deep()
    expect(display.effectiveRowHeight).toBe(15)
    expect(display.height).toBe(DEFAULTS.height)
    expect(display.rowsContentHeight).toBe(15000)
    expect(display.scrollableHeight).toBe(15000 - display.rowsHeight)
  })

  it('a taller track reveals more rows instead of enlarging them', () => {
    const display = deep()
    const scrollable = display.scrollableHeight
    display.resizeHeight(+100)
    expect(display.height).toBe(DEFAULTS.height + 100)
    expect(display.effectiveRowHeight).toBe(15)
    expect(display.scrollableHeight).toBeCloseTo(scrollable - 100)
  })

  it('clamps a scroll past the last row', () => {
    const display = deep()
    display.setScrollTop(1e6)
    expect(display.scrollTop).toBe(display.scrollableHeight)
    display.setScrollTop(-10)
    expect(display.scrollTop).toBe(0)
  })

  it('re-clamps a stranded scroll when the content shrinks', () => {
    const display = deep()
    display.setScrollTop(display.scrollableHeight)
    const bottom = display.scrollTop
    expect(bottom).toBe(15000 - display.rowsHeight)
    // shorter rows leave far less to scroll through, and the offset was sitting
    // at the old bottom — nothing but the clamp autorun brings it back
    display.setRowHeight(2)
    expect(display.scrollTop).toBe(display.scrollableHeight)
    expect(display.scrollTop).toBeLessThan(bottom)
  })

  // The canvas-size guard that used to shrink every row now sits on the rows
  // viewport, which is the thing with a backing store.
  it('keeps the rows canvas under the backing-store ceiling on a huge drag', () => {
    const display = deep()
    display.resizeHeight(+100_000)
    expect(display.rowsHeight).toBe(display.maxRowsHeight)
  })
})

test('fit-to-display-height never scrolls', () => {
  const display = setup(447, 0)
  expect(display.rowsContentHeight).toBeCloseTo(display.rowsHeight)
  expect(display.scrollableHeight).toBe(0)
})

// The track keeps its `height` however many species there are, and fit mode
// (the shipped default, rowHeight 0) shrinks the rows into it: a track never
// grows by its row count.
describe('fit-to-display-height keeps the track height', () => {
  const fit = (n: number) => setup(n, 0)

  it('holds the default height whatever the species count', () => {
    for (const n of [3, 30, 447, 2000]) {
      expect(fit(n).height).toBeCloseTo(DEFAULTS.height)
    }
  })

  it('divides the rows viewport among the species', () => {
    const display = fit(447)
    expect(display.effectiveRowHeight).toBeCloseTo(
      (DEFAULTS.height - display.rowsTopOffset) / 447,
    )
  })

  it('does not grow when a discovering track finds more species', () => {
    const display = fit(10)
    const before = display.height
    display.setSamples({
      samples: Array.from({ length: 40 }, (_, i) => ({
        id: `x${i}`,
        label: `x${i}`,
      })),
      treeNewick: undefined,
      samplesCanonical: false,
    })
    expect(display.sources.length).toBe(50)
    expect(display.height).toBeCloseTo(before)
  })

  it('takes a stated or dragged height', () => {
    const display = fit(447)
    display.configuration.setSlot('height', 2000)
    expect(display.height).toBeCloseTo(2000)
    display.resizeHeight(+400)
    expect(display.height).toBeCloseTo(2400)
  })
})

// The bands drag by delta, so the floor has to be expressed in terms of the
// current height rather than the bare 20px constant — same rule (and same
// regression) as the alignments coverage/arc/sashimi bands, now shared via
// clampBandHeight. See LinearAlignmentsDisplay/bandHeight.test.ts.
describe('resizable band height floor', () => {
  it('stops a drag from shrinking a default band below 20', () => {
    const display = setup(10, 15)
    expect(display.coverageHeight).toBe(45)
    display.resizeCoverageHeight(-100)
    expect(display.coverageHeight).toBe(20)
  })

  it('leaves a band config declared below the floor where it is', () => {
    const display = setup(10, 15)
    setConf(display, ['coverage', 'height'], 5)
    // the regression: flooring at a bare 20 made this first +1 drag jump the
    // band up to 20 before it honored the delta
    display.resizeCoverageHeight(+1)
    expect(display.coverageHeight).toBe(6)
  })

  it('still refuses to shrink a below-floor band further', () => {
    const display = setup(10, 15)
    setConf(display, ['coverage', 'height'], 5)
    display.resizeCoverageHeight(-1)
    expect(display.coverageHeight).toBe(5)
  })

  it('restores the 20 floor once a below-floor band is dragged past it', () => {
    const display = setup(10, 15)
    setConf(display, ['coverage', 'height'], 5)
    display.resizeCoverageHeight(+20)
    expect(display.coverageHeight).toBe(25)
    display.resizeCoverageHeight(-100)
    expect(display.coverageHeight).toBe(20)
  })

  it('applies the same rule to the conservation band', () => {
    const display = setup(10, 15)
    expect(display.conservationHeight).toBe(40)
    display.resizeConservationHeight(-100)
    expect(display.conservationHeight).toBe(20)

    setConf(display, ['conservation', 'height'], 8)
    display.resizeConservationHeight(+1)
    expect(display.conservationHeight).toBe(9)
  })
})

test('hidden alignments draw no tree and reserve no gutter', () => {
  const { display } = createMafTestEnvironment().createDisplay()
  display.setSamples({
    samples: ['a', 'b', 'c'].map(id => ({ id, label: id })),
    treeNewick: '((a,b),c);',
    samplesCanonical: true,
  })
  expect(display.hierarchy).toBeDefined()
  expect(treeSidebarOffset(display)).toBe(display.treeAreaWidth)

  display.setShowAlignments(false)
  expect(display.hierarchy).toBeUndefined()
  expect(treeSidebarOffset(display)).toBe(0)
  expect(display.scrollContentHeight).toBe(0)
})
