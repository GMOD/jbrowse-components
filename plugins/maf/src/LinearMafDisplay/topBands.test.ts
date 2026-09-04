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
// slot afterwards, so `statedBandBounds` binds it at read time and the
// reservation is deliberately smaller than the number the config still holds.
// Everything that paints, scales or positions the band has to read the
// reservation rather than the slot, or it draws over the rows and takes its own
// resize handle off the display with it.
describe('a band stated taller than the track it sits on', () => {
  const overStated = () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setShowConservation(true)
    display.setHeight(1000)
    display.resizeConservationHeight(+260)
    expect(display.conservationHeight).toBe(300)
    display.setHeight(200)
    return display
  }

  it('reserves the bound height, not the stated one', () => {
    const display = overStated()
    expect(display.conservationHeight).toBe(300)
    expect(display.conservationDisplayHeight).toBe(180)
    expect(display.coverageDisplayHeight).toBe(45)
    expect(display.topBands.top.conservation).toBe(45)
    expect(display.rowsTopOffset).toBe(225)
  })

  it('ends exactly where the rows begin', () => {
    const display = overStated()
    const { top, reserved } = display.topBands
    expect(top.conservation + reserved.conservation).toBe(display.rowsTopOffset)
  })
})
