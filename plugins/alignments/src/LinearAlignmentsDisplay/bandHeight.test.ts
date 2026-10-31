import { setConf } from '@jbrowse/core/configuration'

import { requireReadsConf } from './configSlotViews.ts'
import {
  bootAlignmentsDisplay,
  makeEmptyAlignmentsResult,
  oneReadWithMate,
} from './testUtils.ts'

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

    setConf(requireReadsConf(display), ['sashimi', 'height'], 8)
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
    setConf(requireReadsConf(display), ['sashimi', 'height'], 5000)
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

// The bands share one plot, so each one's ceiling counts the bands stacked
// with it: two bands each at their own ceiling took the pileup to 0 px and
// grew the stack past the track's slot.
describe('two bands at their ceilings', () => {
  function withArcBand() {
    console.warn = jest.fn()
    const { baseSession, mount } = bootAlignmentsDisplay()
    const asm = {
      initialized: true,
      regions: [
        { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
      ],
      getCanonicalRefName: (refName: string) => refName,
      getCanonicalRefName2: (refName: string) => refName,
    }
    const { view, display } = mount(
      baseSession.volatile(() => ({
        rpcManager: {
          call: jest.fn(() => Promise.resolve(makeEmptyAlignmentsResult())),
        },
        assemblyManager: {
          get: (name: string) => (name === 'volvox' ? asm : undefined),
          isValidRefName: () => true,
        },
      })),
    )
    view.setWidth(800)
    const region = {
      assemblyName: 'volvox',
      start: 0,
      end: 10_000,
      refName: 'ctgA',
    }
    view.setDisplayedRegions([region])
    display.setDrawnReadConnections('link')
    display.setReadConnectionsPlacement('down')
    display.setRpcData(
      0,
      { groups: [{ key: '', label: '', data: oneReadWithMate(2000) }] },
      region,
    )
    expect(display.belowCoverageBands.hasArcsBand).toBe(true)
    return display
  }

  it('leave the pileup its floor and the track its slot', () => {
    const display = withArcBand()
    const slot = display.height
    display.setCoverageHeight(5000)
    display.setReadConnectionsHeight(5000)
    expect(display.height).toBe(slot)
    expect(display.belowCoverageBands.bottom).toBe(slot - 20)
    expect(display.scrollViewportHeight).toBe(20)
  })

  it('stop a drag on the lower band at the room the upper one left', () => {
    const display = withArcBand()
    const slot = display.height
    display.setCoverageHeight(100)
    display.setReadConnectionsHeight(5000)
    expect(display.readConnectionsHeight).toBe(slot - 20 - 100)
    expect(display.belowCoverageBands.bottom).toBe(slot - 20)
  })

  it('bind stated heights top-down, the upper band first', () => {
    const display = withArcBand()
    const slot = display.height
    setConf(display, ['coverage', 'height'], 5000)
    setConf(display, ['readConnections', 'height'], 5000)
    expect(display.bandHeights.coverageHeight).toBe(slot - 20)
    expect(display.bandHeights.readConnectionsHeight).toBe(0)
    expect(display.belowCoverageBands.bottom).toBe(slot - 20)
    expect(display.belowCoverageBands.hasArcsBand).toBe(false)
  })
})
