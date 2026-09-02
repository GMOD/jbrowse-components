import { stageByteEstimate } from '@jbrowse/display-test-utils'
import { getMembers } from '@jbrowse/mobx-state-tree'

import { createRpcTestEnvironment as createTestEnvironment } from './testUtils.ts'

// Derived regionTooLarge: a pure function of the cached byte estimate scaled to
// the current viewport, driving the shared RegionTooLargeMixin gate — the same
// suite maf/LD/MSV use, plus alignments' onRegionTooLarge hover-clear.
// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
})

describe('alignments derived regionTooLarge', () => {
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

  // The byte axis has no span floor: `gateActive` carries the opt-in and
  // force-load and nothing else, so a gene-sized window over a deep pileup —
  // tens of MB, and exactly the fetch the old floor declined to look at — is
  // judged the same way a whole-chromosome one is.
  it('keeps gating below the AUTO_FORCE_LOAD_BP floor', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1e9)
    expect(display.regionTooLarge).toBe(true)

    // zooming past the floor is not a way to download what the gate just
    // refused: the verdict stands until a measurement moves it, and the BAI
    // quotes whole blocks so the next one will not.
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.gateActive).toBe(true)
    expect(display.regionTooLarge).toBe(true)
  })

  // Two re-measures that come back identical at very different zooms are what
  // tells the banner to stop offering "zoom in to see features" — the BAI stops
  // resolving span at its 16kb bins, so the same bytes come down however far the
  // user goes. Evidence, not a threshold: nothing here knows about 20kb.
  it('stops offering zoom once two measurements say it does not help', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1e9)
    expect(display.zoomCanReleaseGate).toBe(true)

    view.zoomTo(0.01)
    expect(view.visibleBp).toBeLessThan(20_000)
    stageByteEstimate(display, 1e9)
    expect(display.gateActive).toBe(true)
    expect(display.zoomCanReleaseGate).toBe(false)
    expect(display.regionTooLarge).toBe(true)

    // and force-load is the way out the banner offers instead
    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  // Ordinary depth is nowhere near the cap at gene zoom, which is what makes the
  // opt-out safe without a coverage threshold. Measured for reference: the
  // BAI-derived estimate is flat below the index's 16kb minimum bin, so the cap
  // bites at roughly 5 Mb / 16 kb ≈ 300 bytes per reference base.
  it('leaves an ordinary pileup alone below the floor', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)
    stageByteEstimate(display, 300_000)
    expect(display.gateActive).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('releases when a re-measure comes back under the cap', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    // zoom alone changes nothing — the stored number is a measurement, not a
    // rate to scale
    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)

    // the while-gated re-measure lands and the BAI really does quote less here
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

  // Force-load approves the whole track, not one locus, so navigation must not
  // re-arm the gate — re-prompting on every chromosome is the friction the
  // track-wide flag replaced the per-region ceiling to avoid.
  it('keeps force-load across region navigation', () => {
    const { display, view } = createTestEnvironment().createDisplay()

    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    stageByteEstimate(display, 1_500_000)
    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  // The banner replaces the pileup, so a hover held across the flip pins to a
  // feature nobody can see. The fourth axis of
  // `installClearHoverOnViewportChange`.
  it('clears the hover when the region becomes too large', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setHoverState({
      overCigarItem: false,
      featureIdUnderMouse: 'read-123',
      mouseoverExtraInformation: undefined,
      highlightedChainReadIds: [],
    })
    expect(display.featureIdUnderMouse).toBe('read-123')

    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)
    expect(display.featureIdUnderMouse).toBeUndefined()
  })

  // The release is the direction that shows: Force load remounts the subtree and
  // a box drawn off the hovered id reappears under no cursor.
  it('clears the hover again when force load releases the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    display.setHoverState({
      overCigarItem: false,
      featureIdUnderMouse: 'read-123',
      mouseoverExtraInformation: undefined,
      highlightedChainReadIds: [],
    })
    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
    expect(display.featureIdUnderMouse).toBeUndefined()
  })
})
