import { getMembers } from '@jbrowse/mobx-state-tree'

import { createMafTestEnvironment } from './testEnv.ts'

// Derived regionTooLarge: a pure function of the cached byte estimate scaled to
// the current viewport. These lock in the self-releasing behavior — a banner
// that clears on zoom-in (not stuck), doesn't flicker on pan, and a force-load
// that stays cleared even after a zoom-out (the invariant that once bit LD).
// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createMafTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
})

// The summary swap and the gate ask the same "how zoomed out am I" question, so
// `showSummary` reads the gate's own `aboveForceLoadFloor` rather than restating
// the threshold. These pin both directions of that read, and the mutual
// exclusion it creates: `byteGateEnabled` is `!showSummary`, so a getter chain
// that let the floor read the opt-in would be a cycle.
describe('MAF summary swap vs the force-load floor', () => {
  it('never summarizes without a summary adapter, however wide the view', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.aboveForceLoadFloor).toBe(true)
    expect(display.showSummary).toBe(false)
    // so the detail path is what gates
    expect(display.byteGateEnabled).toBe(true)
  })

  it('summarizes above the floor and swaps back to the gated detail path below it', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    view.zoomTo(100)
    expect(display.showSummary).toBe(true)
    // the cheap zoom-reduced read must never be blocked by the byte gate
    expect(display.byteGateEnabled).toBe(false)
    expect(display.gateActive).toBe(false)

    view.zoomTo(20)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.aboveForceLoadFloor).toBe(false)
    expect(display.showSummary).toBe(false)
    expect(display.byteGateEnabled).toBe(true)
  })

  it('summarizes nothing before the view is measured', () => {
    const { display } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay(/* unmeasured */ { skipWidth: true })
    expect(display.aboveForceLoadFloor).toBe(false)
    expect(display.showSummary).toBe(false)
  })
})

describe('MAF derived regionTooLarge', () => {
  it('is false with no estimate yet', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100) // visibleBp ≈ 80_000 > AUTO_FORCE_LOAD_BP
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  it('self-releases on zoom-in via scaling, without an imperative clear', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // half the span → scaled estimate ~750kB < 1MB cap, still above the floor:
    // clears via the derived scaling, not the AUTO_FORCE_LOAD_BP shortcut.
    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // pan (same zoom) keeps it too large; the estimate is not cleared
    view.scrollTo(view.offsetPx + 200)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load raises the limit and clears the banner', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // the declarative equivalent of clicking "Force load"
    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // zoom out: the scaled estimate grows past the raw captured bytes, so a
    // limit raised only past the raw bytes would leave the banner up
    view.zoomTo(400)
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  // afterAttach installs the onDisplayedRegionsChange autorun that drops the
  // cached estimate on chromosome navigation. Without it, a previous region's
  // estimate would gate the new region against the wrong stats and, because
  // FetchVisibleRegions gates on !regionTooLarge, wedge the banner permanently.
  it('clears the cached estimate on region navigation so it cannot wedge', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })
})
