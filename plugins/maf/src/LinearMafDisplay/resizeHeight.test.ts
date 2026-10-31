import { setConf } from '@jbrowse/core/configuration'
import { treeSidebarOffset } from '@jbrowse/tree-sidebar'

import { DEFAULTS } from './displayDefaults.ts'
import { createMafTestEnvironment } from './testEnv.ts'

function setup(nSamples: number) {
  const { display } = createMafTestEnvironment().createDisplay()
  display.setSamples({
    samples: Array.from({ length: nSamples }, (_, i) => ({
      name: `s${i}`,
      label: `s${i}`,
    })),
    treeNewick: undefined,
    samplesCanonical: true,
  })
  return display
}

test('drag tracks the cursor in both directions', () => {
  const display = setup(10)

  const before = display.height
  display.resizeHeight(+100)
  expect(display.height - before).toBeCloseTo(100)

  const mid = display.height
  display.resizeHeight(-60)
  expect(display.height - mid).toBeCloseTo(-60)
})

// The track keeps its `height` however many species there are, and the rows
// shrink into it: a track never grows by its row count, and never scrolls.
describe('the rows always fit the track height', () => {
  it('holds the default height whatever the species count', () => {
    for (const n of [3, 30, 447, 2000]) {
      expect(setup(n).height).toBeCloseTo(DEFAULTS.height)
    }
  })

  it('divides the rows area among the species', () => {
    const display = setup(447)
    expect(display.effectiveRowHeight).toBeCloseTo(
      (DEFAULTS.height - display.rowsTopOffset) / 447,
    )
  })

  it('never scrolls, however many species', () => {
    const display = setup(1000)
    expect(display.rowsContentHeight).toBeCloseTo(display.rowsHeight)
    expect(display.scrollableHeight).toBe(0)
    display.setScrollTop(500)
    expect(display.scrollTop).toBe(0)
  })

  it('a taller track makes taller rows', () => {
    const display = setup(10)
    const before = display.effectiveRowHeight
    display.resizeHeight(+100)
    expect(display.effectiveRowHeight).toBeCloseTo(before + 10)
  })

  it('does not grow when a discovering track finds more species', () => {
    const display = setup(10)
    const before = display.height
    display.setSamples({
      samples: Array.from({ length: 40 }, (_, i) => ({
        name: `x${i}`,
        label: `x${i}`,
      })),
      treeNewick: undefined,
      samplesCanonical: false,
    })
    expect(display.sources.length).toBe(50)
    expect(display.height).toBeCloseTo(before)
  })

  it('takes a stated or dragged height', () => {
    const display = setup(447)
    display.configuration.setSlot('height', 2000)
    expect(display.height).toBeCloseTo(2000)
    display.resizeHeight(+400)
    expect(display.height).toBeCloseTo(2400)
  })

  it('keeps the rows canvas under the backing-store ceiling on a huge drag', () => {
    const display = setup(10)
    display.resizeHeight(+100_000)
    expect(display.rowsHeight).toBe(display.maxRowsHeight)
  })
})

describe('a pinned rowHeight from an older config or link is dropped', () => {
  const species = Array.from({ length: 1000 }, (_, i) => ({
    name: `s${i}`,
    label: `s${i}`,
  }))
  function expectFits(display: ReturnType<typeof setup>) {
    display.setSamples({
      samples: species,
      treeNewick: undefined,
      samplesCanonical: true,
    })
    expect(display.height).toBeCloseTo(DEFAULTS.height)
    expect(display.scrollableHeight).toBe(0)
  }

  it('in a track config', () => {
    expectFits(
      createMafTestEnvironment({
        displayConfig: { rowHeight: 15 },
      }).createDisplay().display,
    )
  })

  it('in a session display snapshot', () => {
    expectFits(
      createMafTestEnvironment().createDisplay({
        displaySnapshot: { rowHeight: 15 },
      }).display,
    )
  })
})

// A band's floor has to be expressed in terms of the
// current height rather than the bare 20px constant — same rule (and same
// regression) as the alignments coverage/arc/sashimi bands, now shared via
// clampBandHeight. See LinearAlignmentsDisplay/bandHeight.test.ts.
describe('resizable band height floor', () => {
  it('stops a drag from shrinking a default band below 20', () => {
    const display = setup(10)
    expect(display.coverageHeight).toBe(45)
    display.setCoverageHeight(display.coverageHeight - 100)
    expect(display.coverageHeight).toBe(20)
  })

  it('leaves a band config declared below the floor where it is', () => {
    const display = setup(10)
    setConf(display, ['coverage', 'height'], 5)
    // the regression: flooring at a bare 20 made this first +1 drag jump the
    // band up to 20 before it honored the delta
    display.setCoverageHeight(display.coverageHeight + 1)
    expect(display.coverageHeight).toBe(6)
  })

  it('still refuses to shrink a below-floor band further', () => {
    const display = setup(10)
    setConf(display, ['coverage', 'height'], 5)
    display.setCoverageHeight(display.coverageHeight - 1)
    expect(display.coverageHeight).toBe(5)
  })

  it('restores the 20 floor once a below-floor band is dragged past it', () => {
    const display = setup(10)
    setConf(display, ['coverage', 'height'], 5)
    display.setCoverageHeight(display.coverageHeight + 20)
    expect(display.coverageHeight).toBe(25)
    display.setCoverageHeight(display.coverageHeight - 100)
    expect(display.coverageHeight).toBe(20)
  })

  it('applies the same rule to the conservation band', () => {
    const display = setup(10)
    expect(display.conservationHeight).toBe(40)
    display.setConservationHeight(display.conservationHeight - 100)
    expect(display.conservationHeight).toBe(20)

    setConf(display, ['conservation', 'height'], 8)
    display.setConservationHeight(display.conservationHeight + 1)
    expect(display.conservationHeight).toBe(9)
  })
})

test('hidden alignments draw no tree and reserve no gutter', () => {
  const { display } = createMafTestEnvironment().createDisplay()
  display.setSamples({
    samples: ['a', 'b', 'c'].map(name => ({ name, label: name })),
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
