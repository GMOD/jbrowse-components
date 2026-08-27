import { getConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from '../LinearBasicDisplay/testEnv.ts'

import type {
  GateHost,
  RegionGateMeasurement,
} from './CanvasFeatureGateMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// The gate reads one config slot, `maxFeatureScreenDensity`, through a host cast
// it declares itself. Cast to `AnyConfigurationModel` and that read checks
// nothing and a typo answers `undefined` forever, which reads as a gate that
// never fires.
const gatePin: HostChecksSlotNames<GateHost> = true

test('the host type checks the slot name the gate reads through it', () => {
  const host = {} as GateHost
  const read = () => {
    // @ts-expect-error
    return getConf(host, 'maxFeatureScreenDensty')
  }
  expect([gatePin, read]).toHaveLength(2)
})

// LinearBasicDisplay, because it is the one display composing this mixin —
// multi-row runs on the byte axis alone and has no counts to store at all.
function gatedDisplay() {
  const env = createTestEnvironment({ adapterFetchSizeLimit: 50_000_000 })
  const { display, view, track } = env.createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
  ])
  // visibleBp 25,400, over AUTO_FORCE_LOAD_BP, so the density axis is live
  view.zoomTo(62.5)
  // the verdict is a live max at the DEBOUNCED coarse scale, so settle it
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  return { display, view, track }
}

// 5,000 features over the 406px the region occupies — twelve per pixel against
// the default budget of one.
const DENSE: RegionGateMeasurement[] = [
  {
    displayedRegionIndex: 0,
    region: { start: 0, end: 25_400 },
    result: { featureCount: 5000 },
  },
]

// A different file behind the same track config, which is all `tierKey` is: a
// stringified snapshot of the adapter the fetch was issued against.
function swapAdapterConfig(track: {
  configuration: {
    adapter: { setSlot: (name: string, value: unknown) => void }
  }
}) {
  track.configuration.adapter.setSlot('fetchSizeLimit', 40_000_000)
}

describe('the density commit takes the tier guard', () => {
  it('commits the counts a live fetch measured', () => {
    const { display } = gatedDisplay()

    display.commitGateMeasurements(DENSE, display.gateFetchState())

    expect(display.densityStatsPerRegion.get(0)).toEqual({
      featureCount: 5000,
      regionWidthBp: 25_400,
    })
    expect(display.densityTooLarge).toBe(true)
  })

  // The user-visible half of the 2026-08 tier bug, and the half no budget file
  // covers. `nextGateState` already dropped the BYTE estimate of a fetch issued
  // against a config that has since changed; the density half committed
  // regardless, so the banner said "too many features" over a count from a file
  // the track no longer points at — and a fresh fetch of the new file cannot
  // clear it, because the stale numbers are already stored.
  it('drops counts a fetch measured against the previous adapter config', () => {
    const { display, track } = gatedDisplay()

    const issued = display.gateFetchState()
    swapAdapterConfig(track)
    expect(display.byteGateAdapterKey).not.toBe(issued.tierKey)

    display.commitGateMeasurements(DENSE, issued)

    expect(display.densityStatsPerRegion.size).toBe(0)
    expect(display.densityTooLarge).toBe(false)
  })

  // ...and the same batch is taken once it describes the file that is live now,
  // so the guard is a tier check rather than an off-switch.
  it('takes the same counts from a fetch against the config now live', () => {
    const { display, track } = gatedDisplay()
    swapAdapterConfig(track)

    display.commitGateMeasurements(DENSE, display.gateFetchState())

    expect(display.densityTooLarge).toBe(true)
  })

  // A display that never gates has no tier to disagree about — the byte half
  // waives the guard on `tierKey: undefined` and the density half has to waive
  // it the same way, or an ungated display silently stops measuring.
  it('accepts a measurement carrying no tier at all', () => {
    const { display } = gatedDisplay()

    display.commitGateMeasurements(DENSE, {
      ...display.gateFetchState(),
      tierKey: undefined,
    })

    expect(display.densityTooLarge).toBe(true)
  })
})
