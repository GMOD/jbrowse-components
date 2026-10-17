import { setConf } from '@jbrowse/core/configuration'

import { bootAlignmentsDisplay } from './testUtils.ts'

// Builds a real LinearAlignmentsDisplay so the floor is exercised through the
// actual setters the resize handles call, rather than a reimplementation.
function createDisplay() {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  // no `call`: nothing here is meant to reach a fetch, so one would throw
  return mount(baseSession.volatile(() => ({ rpcManager: {} }))).display
}

// The resize handles drag by calling `set*Height(current + dy)`, so the floor
// has to be expressed in terms of the current height, not a constant.
describe('resizable band height floor', () => {
  it('stops a drag from shrinking a default band below 20', () => {
    const display = createDisplay()
    expect(display.coverageHeight).toBe(45)
    display.setCoverageHeight(10)
    expect(display.coverageHeight).toBe(20)
  })

  it('leaves a band config declared below the floor where it is', () => {
    const display = createDisplay()
    setConf(display, ['coverage', 'height'], 5)
    // the regression: this flooring at 20 made the first drag jump the band up
    // to 20 before it honored the +1
    display.setCoverageHeight(6)
    expect(display.coverageHeight).toBe(6)
  })

  it('still refuses to shrink a below-floor band further', () => {
    const display = createDisplay()
    setConf(display, ['coverage', 'height'], 5)
    display.setCoverageHeight(3)
    expect(display.coverageHeight).toBe(5)
  })

  it('restores the 20 floor once a below-floor band is dragged past it', () => {
    const display = createDisplay()
    setConf(display, ['coverage', 'height'], 5)
    display.setCoverageHeight(25)
    expect(display.coverageHeight).toBe(25)
    display.setCoverageHeight(10)
    expect(display.coverageHeight).toBe(20)
  })

  // The other half of the rule, which this family did not have until the two
  // clampBandHeight implementations were merged: without a ceiling a band
  // dragged past the display height takes `scrollViewportHeight` to 0 and its
  // own handle off the bottom edge, so there is no gesture left that shrinks it.
  it('stops a drag from squashing the pileup to nothing', () => {
    const display = createDisplay()
    display.setCoverageHeight(5000)
    expect(display.coverageHeight).toBe(display.height - 20)
    expect(display.scrollViewportHeight).toBeGreaterThan(0)
  })

  it('brings a band already over its ceiling back inside', () => {
    const display = createDisplay()
    setConf(display, ['coverage', 'height'], 5000)
    display.setCoverageHeight(4999)
    expect(display.coverageHeight).toBe(display.height - 20)
  })

  it('applies the same rule to the sashimi and read-connection bands', () => {
    const display = createDisplay()
    display.setSashimiHeight(10)
    expect(display.sashimiHeight).toBe(20)
    display.setReadConnectionsHeight(10)
    expect(display.readConnectionsHeight).toBe(20)

    setConf(display, ['sashimi', 'height'], 8)
    display.setSashimiHeight(9)
    expect(display.sashimiHeight).toBe(9)

    setConf(display, ['readConnections', 'height'], 8)
    display.setReadConnectionsHeight(9)
    expect(display.readConnectionsHeight).toBe(9)
  })
})

// A band dragged tall stays tall in its slot when the track is later made
// shorter, and a config can state any height. The layout reserved the bound
// height while the axis ticks, the arc draw band and the sashimi strips drew
// the raw one, so the bars and their axis disagreed and arcs painted over the
// pileup.
describe('a stated band height past its ceiling', () => {
  it('is drawn at the height the layout reserves', () => {
    const display = createDisplay()
    setConf(display, ['coverage', 'height'], 5000)
    setConf(display, ['sashimi', 'height'], 5000)
    setConf(display, ['readConnections', 'height'], 5000)
    const ceiling = display.fitTargetHeight - 20
    expect(display.bandHeights).toEqual({
      coverageHeight: ceiling,
      sashimiHeight: ceiling,
      readConnectionsHeight: ceiling,
    })
    expect(display.sections.sections[0]!.coverageHeight).toBe(ceiling)
    expect(display.belowCoverageBands.coverageHeight).toBe(ceiling)
  })
})
