import { stageByteEstimate } from '@jbrowse/display-test-utils'

import { createTestEnvironment } from './testEnv.ts'

// Derived regionTooLarge: a pure function of the cached byte estimate scaled to
// the current viewport — self-releases on zoom-in, no flicker on pan, force-load
// stays cleared after a zoom-out, estimate cleared on chromosome nav. Same suite
// LD/maf use, driving the shared RegionTooLargeMixin derived gate.
describe('MultiSampleVariant derived regionTooLarge', () => {
  it('is false with no estimate yet', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100) // visibleBp ≈ 80_000 > AUTO_FORCE_LOAD_BP
    stageByteEstimate(display, 1_500_000)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  // Zoom is not a verdict: the stored figure is what the index quoted for the
  // viewport it was taken at, not a rate to scale by span. The fetch autorun
  // re-runs once per settled viewport while the banner holds, and the
  // measurement it takes is what releases it.
  it('holds until a fresh measurement releases it, not on zoom alone', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(50)
    expect(display.estimatedFetchBytes).toBe(1_500_000)
    expect(display.regionTooLarge).toBe(true)
    // ...and the autorun knows to go and ask again
    expect(display.gateMeasurementStale).toBe(true)

    stageByteEstimate(display, 700_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    view.scrollTo(view.offsetPx + 200)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load raises the limit and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    // the declarative equivalent of clicking "Force load"
    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(400)
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('clears the cached estimate on region navigation so it cannot wedge', () => {
    const { display, view } = createTestEnvironment().createDisplay()

    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })
})
