import { setConf } from '@jbrowse/core/configuration'
import { SIDEBAR_HINT_LINE_PX } from '@jbrowse/tree-sidebar'

import { createMafTestEnvironment } from './testEnv.ts'

// The band stack is stated once, in `topBands`, and everything that reserves,
// paints or picks reads that fold. These tests are the sabotage guard for the
// two contract rules the fold enforces: a band that is off spends 0 px, and a
// top is never restated as the band-above's height.
describe('the top bands are one fold', () => {
  it('a band that is off costs zero px, not its floor', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setShowConservation(true)
    const both = display.rowsTopOffset
    expect(both).toBe(display.coverageHeight + display.conservationHeight)

    display.setShowCoverage(false)
    expect(display.topBands.reserved.coverage).toBe(0)
    expect(display.rowsTopOffset).toBe(display.conservationHeight)

    display.setShowConservation(false)
    expect(display.rowsTopOffset).toBe(0)
  })

  it('conservation begins exactly where coverage ends', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setShowConservation(true)
    const { top, reserved, bottom } = display.topBands
    expect(top.coverage).toBe(0)
    expect(top.conservation).toBe(reserved.coverage)
    expect(bottom).toBe(reserved.coverage + reserved.conservation)

    // coverage off: conservation moves up to the vacated slot
    display.setShowCoverage(false)
    expect(display.topBands.top.conservation).toBe(0)
  })

  it('the painted labels read the same tops the layout reserved', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setShowConservation(true)
    const { top } = display.topBands
    expect(display.bandLabels.map(l => l.top)).toEqual([
      top.coverage,
      top.conservation,
    ])
  })
})

// A stated band height outlives the track height that made it legal: drag the
// band tall on a tall track, then drag the track short. Nothing re-clamps the
// slot afterwards, so `topBands` binds it at read time, to the room the band
// above it left, and the reservation is deliberately smaller than the number
// the config still holds.
// Everything that paints, scales or positions the band has to read the
// reservation rather than the slot, or it draws over the rows and takes its own
// resize handle off the display with it.
describe('a band stated taller than the track it sits on', () => {
  const overStated = () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setShowConservation(true)
    display.setHeight(1000)
    display.setConservationHeight(display.conservationHeight + 260)
    expect(display.conservationHeight).toBe(300)
    display.setHeight(200)
    return display
  }

  it('reserves the bound height, not the stated one', () => {
    const display = overStated()
    expect(display.conservationHeight).toBe(300)
    expect(display.topBands.rects).toEqual({
      coverage: { top: 0, height: 45 },
      conservation: { top: 45, height: 135 },
    })
    expect(display.rowsTopOffset).toBe(180)
    expect(display.rowsHeight).toBe(20)
  })

  it('ends exactly where the rows begin', () => {
    const display = overStated()
    const { top, reserved } = display.topBands
    expect(top.conservation + reserved.conservation).toBe(display.rowsTopOffset)
  })
})

describe('a kept subset puts the focus chip in a line above the rows', () => {
  it('starts the rows a chip line under the bands within the same track height', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    const bands = display.topBands.bottom
    const height = display.height

    display.setRowFocus(['a'])

    expect(display.renderState.rowsTop).toBe(bands + SIDEBAR_HINT_LINE_PX)
    expect(display.height).toBe(height)
  })
})

// The bands share the track with the rows, so each band's ceiling counts the
// band stacked with it: each bound on its own, two bands at their ceilings
// took the rows to 0 px and grew the track past its slot.
describe('two bands at their ceilings', () => {
  const bothBands = () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setShowConservation(true)
    return display
  }

  it('leave the rows their floor and the track its slot', () => {
    const display = bothBands()
    const slot = display.height
    display.setCoverageHeight(5000)
    display.setConservationHeight(5000)
    expect(display.height).toBe(slot)
    expect(display.rowsHeight).toBe(20)
    const { top, reserved } = display.topBands
    expect(top.conservation + reserved.conservation).toBe(slot - 20)
  })

  it('bind stated heights top-down, the upper band first', () => {
    const display = bothBands()
    const slot = display.height
    setConf(display, ['coverage', 'height'], 5000)
    setConf(display, ['conservation', 'height'], 5000)
    expect(display.topBands.reserved.coverage).toBe(slot - 20)
    expect(display.topBands.reserved.conservation).toBe(0)
    expect(display.height).toBe(slot)
  })

  it('give the bands the whole track while the rows are hidden', () => {
    const display = bothBands()
    const slot = display.height
    display.setShowAlignments(false)
    display.setCoverageHeight(5000)
    display.setConservationHeight(5000)
    expect(display.rowsHeight).toBe(0)
    expect(display.topBands.bottom).toBe(slot)
  })
})
