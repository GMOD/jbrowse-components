import {
  AUTO_FORCE_LOAD_BP,
  SUB_FLOOR_BYTE_BUDGET_FACTOR,
} from '@jbrowse/display-kit/regionTooLargeUtils'

import { createPerRegionTestEnvironment } from './perRegionTestEnv.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { GateOptIns, PerRegionTestDisplay } from './perRegionTestEnv.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'
import type { RegionTooLargeHost } from '@jbrowse/display-kit/RegionTooLargeMixin'

// The mixin's own tests. `regionTooLargeUtils.test.ts` covers the comparison
// half — which axis is over budget, given numbers. This covers the half that
// decides whether an axis may gate at all: the two opt-ins, force-load, the
// 20kb floor, and the measured-viewport precondition, which interact.
//
// It exists because that interaction was pinned nowhere. Five plugins carry a
// `derivedRegionTooLarge.test.ts` between them, 1,681 lines, and dropping
// `aboveForceLoadFloor` from `densityGateActive` left every one of them green —
// it was caught by a single test inside canvas's fetch suite.

// Room to zoom: the view clamps `bpPerPx` against the displayed region, so a
// 100kb contig cannot hold two spans that are both above the 20kb floor and a
// halving apart — which is exactly what the `zoomIneffective` cases need.
const ASSEMBLY_END = 10_000_000

function setup(gate?: GateOptIns, displayConfig?: Record<string, unknown>) {
  const env = createPerRegionTestEnvironment({
    gate,
    assemblyEnd: ASSEMBLY_END,
    ...(displayConfig ? { displayConfig } : {}),
  })
  const { display, view } = env.createDisplay() as {
    display: PerRegionTestDisplay
    view: LinearGenomeViewModel
  }
  return { ...env, display, view }
}

/**
 * Zoom by `bpPerPx` rather than by a target span. The view's window overhangs
 * the region's left edge at offset 0, so the visible span is about half a
 * screen short of `width * bpPerPx` — a helper that took a span would be
 * asserting the view's clamping arithmetic instead of the gate's.
 */
function zoomTo(view: LinearGenomeViewModel, bpPerPx: number) {
  view.zoomTo(bpPerPx)
}

// WIDE and CLOSER both land above the floor and a good deal more than a halving
// apart, which is what the `zoomIneffective` comparison needs; NARROW and TINY
// land below it. The tests assert the resolved span rather than trusting these.
const WIDE = 200
const CLOSER = 60
const NARROW = 25
const TINY = 5

describe('gateEnabled is the whole opt-in', () => {
  it.each([
    ['off by default', {}, false],
    ['on where a display overrides it', { gateEnabled: true }, true],
  ])('%s', (_label, gate, expected) => {
    const { display } = setup(gate)
    expect(display.gateEnabled).toBe(expected)
  })
})

describe('gateActive', () => {
  it('is false for a display that opted into neither axis', () => {
    const { display } = setup({})
    expect(display.gateActive).toBe(false)
  })

  it('is true once a display opts in and the view is measured', () => {
    const { display } = setup({ gateEnabled: true })
    expect(display.gateViewport).toBeDefined()
    expect(display.gateActive).toBe(true)
  })

  it('is false before the view is measured', () => {
    const env = createPerRegionTestEnvironment({
      gate: { gateEnabled: true },
      assemblyEnd: ASSEMBLY_END,
    })
    const { display } = env.createDisplay({ skipWidth: true }) as {
      display: PerRegionTestDisplay
    }
    expect(display.gateViewport).toBeUndefined()
    expect(display.gateActive).toBe(false)
  })

  it('is false while the track is force-loaded', () => {
    const { display } = setup({ gateEnabled: true })
    display.setForceLoadTrack(true)
    expect(display.gateExempt).toBe(true)
    expect(display.gateActive).toBe(false)
  })

  it('is false while the forceLoad config slot is set', () => {
    const { display } = setup(
      { gateEnabled: true },
      {
        forceLoad: true,
      },
    )
    expect(display.gateExempt).toBe(true)
    expect(display.gateActive).toBe(false)
  })
})

describe('the AUTO_FORCE_LOAD_BP floor', () => {
  // Asserted against the span the gate actually resolved, not the one asked
  // for: `zoomTo` clamps and the block bounds round, so a test pinned to the
  // exact threshold is testing the view's arithmetic instead of the floor.
  it.each([WIDE, CLOSER, NARROW, TINY])(
    'agrees with the resolved span at %i bp/px',
    bpPerPx => {
      const { display, view } = setup({ gateEnabled: true })
      zoomTo(view, bpPerPx)
      const { spanBp } = display.gateViewport!
      expect(display.aboveForceLoadFloor).toBe(spanBp >= AUTO_FORCE_LOAD_BP)
    },
  )

  it('the two fixtures really do straddle it', () => {
    const { display, view } = setup({ gateEnabled: true })
    zoomTo(view, CLOSER)
    const closer = display.gateViewport!.spanBp
    zoomTo(view, WIDE)
    const wide = display.gateViewport!.spanBp
    expect(closer).toBeGreaterThanOrEqual(AUTO_FORCE_LOAD_BP)
    // and a material zoom-in apart, so `zoomIneffective` can be provoked
    expect(closer / wide).toBeLessThanOrEqual(0.5)

    zoomTo(view, NARROW)
    expect(display.gateViewport!.spanBp).toBeLessThan(AUTO_FORCE_LOAD_BP)
  })

  it('is false before the view is measured', () => {
    const env = createPerRegionTestEnvironment({
      gate: { gateEnabled: true },
      assemblyEnd: ASSEMBLY_END,
    })
    const { display } = env.createDisplay({ skipWidth: true }) as {
      display: PerRegionTestDisplay
    }
    expect(display.aboveForceLoadFloor).toBe(false)
  })

  // The floor's only remaining job on the byte axis: below it the budget is
  // multiplied rather than the gate switched off, so the gate stays reachable
  // at every zoom instead of being bypassable by zooming into it.
  it('raises the byte budget below itself rather than disabling the gate', () => {
    const { display, view } = setup({ gateEnabled: true })
    zoomTo(view, WIDE)
    const wideLimit = display.gateByteLimit
    expect(display.gateActive).toBe(true)

    zoomTo(view, NARROW)
    expect(display.gateActive).toBe(true)
    expect(display.gateByteLimit).toBe(wideLimit * SUB_FLOOR_BYTE_BUDGET_FACTOR)
  })
})

// The two axes part company here, and only this term separates them. Screen
// density is a model — the last fetch's features-per-bp times the current
// bpPerPx — with nothing measured under it at the span being judged, so it
// keeps the floor the byte axis dropped.
describe('densityGateActive', () => {
  const gate: GateOptIns = {
    gateEnabled: true,
    densityGateEnabled: true,
  }

  it('is on above the floor', () => {
    const { display, view } = setup(gate)
    zoomTo(view, WIDE)
    expect(display.densityGateActive).toBe(true)
  })

  it('is off below the floor, while the byte axis stays on', () => {
    const { display, view } = setup(gate)
    zoomTo(view, NARROW)
    expect(display.gateActive).toBe(true)
    expect(display.densityGateActive).toBe(false)
  })

  it('is off for a display that did not opt the axis in', () => {
    const { display, view } = setup({ gateEnabled: true })
    zoomTo(view, WIDE)
    expect(display.gateActive).toBe(true)
    expect(display.densityGateActive).toBe(false)
  })

  it('is off while force-loaded, above the floor and opted in', () => {
    const { display, view } = setup(gate)
    zoomTo(view, WIDE)
    display.setForceLoadTrack(true)
    expect(display.densityGateActive).toBe(false)
  })

  it('keeps a dense region out of the verdict below the floor', () => {
    const { display, view, control } = setup(gate)
    control.densityTooLarge = true
    zoomTo(view, WIDE)
    expect(display.regionTooLarge).toBe(true)

    zoomTo(view, NARROW)
    expect(display.regionTooLarge).toBe(false)
  })
})

describe('gateByteLimit', () => {
  it('takes the display config default', () => {
    const { display, view } = setup({ gateEnabled: true })
    zoomTo(view, WIDE)
    expect(display.gateByteLimit).toBe(display.configuredFetchSizeLimit)
  })

  it('prefers a positive adapter limit over the config', () => {
    const env = createPerRegionTestEnvironment({
      gate: { gateEnabled: true },
      assemblyEnd: ASSEMBLY_END,
      adapter: {
        name: 'TestAdapter',
        slots: { fetchSizeLimit: { type: 'number', defaultValue: 4242 } },
        config: { type: 'TestAdapter', fetchSizeLimit: 4242 },
      },
    })
    const { display, view } = env.createDisplay() as {
      display: PerRegionTestDisplay
      view: LinearGenomeViewModel
    }
    zoomTo(view, WIDE)
    expect(display.adapterFetchSizeLimit).toBe(4242)
    expect(display.gateByteLimit).toBe(4242)
  })
})

describe('resolvedByteLimit is what the worker enforces', () => {
  it('is the banner’s own number while the gate is active', () => {
    const { display, view } = setup({ gateEnabled: true })
    zoomTo(view, WIDE)
    expect(display.resolvedByteLimit()).toBe(display.gateByteLimit)
  })

  it('is undefined — unlimited — when the gate is off', () => {
    const { display } = setup({})
    expect(display.resolvedByteLimit()).toBeUndefined()
  })

  it('is undefined while force-loaded, so the worker stops gating too', () => {
    const { display } = setup({ gateEnabled: true })
    display.setForceLoadTrack(true)
    expect(display.resolvedByteLimit()).toBeUndefined()
  })
})

// What lets the banner release without an imperative clear: the fetch autoruns
// skip on `regionTooLarge && !gateMeasurementStale`, so a settled viewport that
// has been measured stops fetching and a viewport that has not gets one more.
describe('gateMeasurementStale', () => {
  it('is true before anything has been measured', () => {
    const { display } = setup({ gateEnabled: true })
    expect(display.gateMeasurementStale).toBe(true)
  })

  it('is false once the current viewport is stamped', () => {
    const { display } = setup({ gateEnabled: true })
    display.commitFetchBytes([undefined], display.gateFetchState())
    expect(display.gateMeasurementStale).toBe(false)
  })

  it('goes true again when the viewport moves under it', () => {
    const { display, view } = setup({ gateEnabled: true })
    display.commitFetchBytes([undefined], display.gateFetchState())
    view.scrollTo(view.offsetPx + view.width)
    expect(display.gateMeasurementStale).toBe(true)
  })

  // It records that the gate ASKED about this viewport, not that it learned a
  // number: an adapter quoting no estimate still moves it.
  it('is separate from having an estimate', () => {
    const { display } = setup({ gateEnabled: true })
    display.commitFetchBytes([undefined], display.gateFetchState())
    expect(display.estimatedFetchBytes).toBeUndefined()
    expect(display.gateMeasurementStale).toBe(false)
  })
})

// Asked of the axis that actually tripped, because only the byte axis can
// honestly answer no. Density falls with bpPerPx by construction.
describe('zoomCanReleaseGate', () => {
  function overBudget(display: PerRegionTestDisplay, bytes = 1_000_000_000) {
    display.setByteEstimate({ bytes, viewport: display.gateViewport! })
  }

  it('is true before anything has been measured', () => {
    const { display } = setup({ gateEnabled: true })
    expect(display.zoomCanReleaseGate).toBe(true)
  })

  it('is true on a single measurement — one point is not evidence', () => {
    const { display, view } = setup({ gateEnabled: true })
    zoomTo(view, WIDE)
    overBudget(display)
    expect(display.regionTooLarge).toBe(true)
    expect(display.zoomCanReleaseGate).toBe(true)
  })

  it('goes false when a materially closer zoom returns the same bytes', () => {
    const { display, view } = setup({ gateEnabled: true })
    zoomTo(view, WIDE)
    overBudget(display)
    // an index quotes whole blocks, so this file's estimate does not move
    zoomTo(view, CLOSER)
    overBudget(display)
    expect(display.zoomCanReleaseGate).toBe(false)
  })

  it('comes back the moment the bytes do fall', () => {
    const { display, view } = setup({ gateEnabled: true })
    zoomTo(view, WIDE)
    overBudget(display)
    zoomTo(view, CLOSER)
    overBudget(display)
    expect(display.zoomCanReleaseGate).toBe(false)

    zoomTo(view, CLOSER / 4)
    overBudget(display, 500_000_000)
    expect(display.zoomCanReleaseGate).toBe(true)
  })

  // Reading `zoomIneffective` alone gets this backwards on exactly the files
  // the density axis exists for: a dense VCF is small on disk and flat across
  // zooms, so the flag sets while the banner is held by density — and the
  // banner would then withhold the one way out that works.
  it('stays true on a density banner, however flat the bytes are', () => {
    const { display, view, control } = setup({
      gateEnabled: true,
      densityGateEnabled: true,
    })
    control.densityTooLarge = true
    zoomTo(view, WIDE)
    display.setByteEstimate({ bytes: 1000, viewport: display.gateViewport! })
    // still above the floor, so the density axis is the one holding the banner
    zoomTo(view, CLOSER)
    display.setByteEstimate({ bytes: 1000, viewport: display.gateViewport! })

    expect(display.byteEstimate!.zoomIneffective).toBe(true)
    expect(display.tooLargeStatus.axis).toBe('density')
    expect(display.zoomCanReleaseGate).toBe(true)
  })
})

// "Nothing below the opt-in is evaluated" is a property the ungated composers
// (wiggle, Manhattan, sequence) rely on: those displays have no byte-gate
// adapter to read, and a getter that reached for one would throw on them.
describe('an ungated display evaluates nothing below the opt-in', () => {
  it('answers the whole gate without touching a byte limit', () => {
    const { display } = setup({})
    expect(display.gateEnabled).toBe(false)
    expect(display.gateActive).toBe(false)
    expect(display.regionTooLarge).toBe(false)
    expect(display.regionTooLargeReason).toBe('')
    expect(display.resolvedByteLimit()).toBeUndefined()
  })
})

// One line per mixin, and the whole point of it: a host cast widened back to
// `AnyConfigurationModel` — or written as the `ResolvableDisplay & { … }`
// intersection, which re-widens — compiles and checks nothing, so every slot
// name below it typechecks and a misspelled read reports nothing at any layer.
// `HostChecksSlotNames` resolves to `false` there, and this annotation fails.
const regionTooLargePin: HostChecksSlotNames<RegionTooLargeHost> = true
test('the mixin checks the slot names it reads', () => {
  expect(regionTooLargePin).toBe(true)
})
