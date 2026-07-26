import { createTestEnvironment } from './testEnv.ts'

// Derived regionTooLarge: a pure function of the cached byte estimate scaled to
// the current viewport. These lock in the behavior the imperative path got
// wrong — a banner that stuck on zoom-in (the reported bug), and that would
// flicker on pan.
describe('LD derived regionTooLarge', () => {
  it('is false with no estimate yet', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100) // visibleBp ≈ 80_000 > AUTO_FORCE_LOAD_BP
    display.setByteEstimate({ bytes: 1_500_000 }, view.visibleBp)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  it('self-releases on zoom-in via scaling, without an imperative clear', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({ bytes: 1_500_000 }, view.visibleBp)
    expect(display.regionTooLarge).toBe(true)

    // half the span → scaled estimate ~750kB < 1MB cap, still above the floor:
    // clears via the derived scaling, not the AUTO_FORCE_LOAD_BP shortcut.
    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({ bytes: 1_500_000 }, view.visibleBp)
    expect(display.regionTooLarge).toBe(true)

    // pan (same zoom) keeps it too large; the estimate is not cleared
    view.scrollTo(view.offsetPx + 200)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load raises the limit and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({ bytes: 1_500_000 }, view.visibleBp)
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({ bytes: 1_500_000 }, view.visibleBp)
    expect(display.regionTooLarge).toBe(true)

    // the declarative equivalent of clicking "Force load"
    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({ bytes: 1_500_000 }, view.visibleBp)
    expect(display.regionTooLarge).toBe(true)

    // zoom out: the scaled estimate grows past the raw captured bytes, so a
    // limit raised only past the raw bytes would leave the banner up
    view.zoomTo(400)
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  // The pre-flight path carries the adapter's fetchSizeLimit in the stats
  // (getMultiRegionByteEstimate -> setByteEstimate); the derived
  // gate must prefer it over the display config via resolveByteLimit, else an
  // adapter-declared limit is silently ignored (the bug the canvas path had).
  // LD's config cap is the 1MB baseLinearDisplay floor.
  it('honors an adapter fetchSizeLimit in the stats, over the display config', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    // 3MB estimate: over the 1MB display config, under the 50MB adapter limit
    display.setByteEstimate(
      {
        bytes: 3_000_000,
        fetchSizeLimit: 50_000_000,
      },
      view.visibleBp,
    )
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('gates on the display config when the stats carry no fetchSizeLimit', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    // same 3MB estimate, no adapter limit → the 1MB config floor gates it
    display.setByteEstimate({ bytes: 3_000_000 }, view.visibleBp)
    expect(display.regionTooLarge).toBe(true)
  })

  // afterAttach installs the onDisplayedRegionsChange autorun that drops the
  // cached estimate on chromosome navigation. Without it, a previous region's
  // estimate would gate the new region against the wrong stats and, because the
  // fetch autorun gates on !regionTooLarge, wedge the banner permanently.
  it('clears the cached estimate on region navigation so it cannot wedge', async () => {
    const { display, view } = createTestEnvironment().createDisplay()
    // let afterAttach's dynamic import resolve and install its autoruns
    await new Promise(res => setTimeout(res, 0))

    view.zoomTo(100)
    display.setByteEstimate({ bytes: 1_500_000 }, view.visibleBp)
    expect(display.regionTooLarge).toBe(true)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })
})
