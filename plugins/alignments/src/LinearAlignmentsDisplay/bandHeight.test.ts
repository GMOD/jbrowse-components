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
    display.configuration.setSlot('coverageHeight', 5)
    // the regression: this flooring at 20 made the first drag jump the band up
    // to 20 before it honored the +1
    display.setCoverageHeight(6)
    expect(display.coverageHeight).toBe(6)
  })

  it('still refuses to shrink a below-floor band further', () => {
    const display = createDisplay()
    display.configuration.setSlot('coverageHeight', 5)
    display.setCoverageHeight(3)
    expect(display.coverageHeight).toBe(5)
  })

  it('restores the 20 floor once a below-floor band is dragged past it', () => {
    const display = createDisplay()
    display.configuration.setSlot('coverageHeight', 5)
    display.setCoverageHeight(25)
    expect(display.coverageHeight).toBe(25)
    display.setCoverageHeight(10)
    expect(display.coverageHeight).toBe(20)
  })

  it('applies the same rule to the sashimi and read-connection bands', () => {
    const display = createDisplay()
    display.setSashimiArcsHeight(10)
    expect(display.sashimiArcsHeight).toBe(20)
    display.setReadConnectionsHeight(10)
    expect(display.readConnectionsHeight).toBe(20)

    display.configuration.setSlot('sashimiArcsHeight', 8)
    display.setSashimiArcsHeight(9)
    expect(display.sashimiArcsHeight).toBe(9)

    display.configuration.setSlot('readConnectionsHeight', 8)
    display.setReadConnectionsHeight(9)
    expect(display.readConnectionsHeight).toBe(9)
  })
})
