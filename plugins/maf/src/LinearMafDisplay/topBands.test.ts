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
