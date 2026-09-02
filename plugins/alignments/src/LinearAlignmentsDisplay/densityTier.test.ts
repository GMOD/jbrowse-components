import { ConfigurationSchema, setConf } from '@jbrowse/core/configuration'
import { densityAdapterConfigSchemaFields } from '@jbrowse/core/data_adapters/BaseAdapter'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import { stageByteEstimate } from '@jbrowse/display-test-utils'

import { createRpcTestEnvironment } from './testUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// Config-only, the way `fetchAutorun.test.ts`'s is: the display reads the
// `densityAdapter` slot off the live track config and the RPC is mocked, so the
// class is never built.
function registerDensityAdapter(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'TestDensityAdapter',
        configSchema: ConfigurationSchema('TestDensityAdapter', {
          ...densityAdapterConfigSchemaFields,
        }),
        getAdapterClass: () => {
          throw new Error('TestDensityAdapter is config-only in tests')
        },
      }),
  )
}

// A display over an adapter that either carries a density sidecar or does not,
// with its byte measurement optionally back over budget — the state that raises
// the banner.
function densityDisplay({
  withSource,
  refused = true,
}: {
  withSource: boolean
  refused?: boolean
}) {
  const { createDisplay } = createRpcTestEnvironment({
    register: registerDensityAdapter,
    trackConfig: {
      adapter: {
        type: 'TestDensityAdapter',
        densityAdapter: withSource
          ? { type: 'BigWigAdapter', uri: 'density.bw' }
          : null,
      },
    },
  })
  const { display, view } = createDisplay()
  view.zoomTo(100)
  if (refused) {
    stageByteEstimate(display, 1_500_000)
  }
  return { display, view }
}

function refusedDisplay({ withSource }: { withSource: boolean }) {
  return densityDisplay({ withSource })
}

function bins(starts: number[], ends: number[], scores: number[]) {
  return {
    starts: Uint32Array.from(starts),
    ends: Uint32Array.from(ends),
    scores: Float32Array.from(scores),
  }
}

test('a refused region with a density source swaps to the band', () => {
  const { display } = refusedDisplay({ withSource: true })
  expect(display.regionTooLarge).toBe(true)
  expect(display.hasDensitySource).toBe(true)
  expect(display.densityTierActive).toBe(true)
  // the banner replaces the whole subtree, so the phase is what decides whether
  // there is a canvas to draw the band on at all
  expect(display.displayPhase).not.toBe('tooLarge')
})

test('a refused region with no density source keeps the banner', () => {
  const { display } = refusedDisplay({ withSource: false })
  expect(display.regionTooLarge).toBe(true)
  expect(display.hasDensitySource).toBe(false)
  expect(display.densityTierActive).toBe(false)
  expect(display.displayPhase).toBe('tooLarge')
})

test('the tier is loading until its bins land, then ready', () => {
  const { display } = refusedDisplay({ withSource: true })
  expect(display.densityCoverageRegions.size).toBe(0)
  expect(display.displayPhase).toBe('loading')

  display.setDensityBins(
    [{ displayedRegionIndex: 0, bins: bins([0], [100_000], [4000]) }],
    { regions: [], bucket: 0, adapterKey: 'test-key' },
  )
  expect(display.densityCoverageRegions.size).toBe(1)
  expect(display.displayPhase).toBe('ready')
})

// The verdict itself is untouched — the phase is the banner's, and the fetch
// gating reads `regionTooLarge` directly.
test('the swap does not release the fetch gate', () => {
  const { display } = refusedDisplay({ withSource: true })
  display.setDensityBins(
    [{ displayedRegionIndex: 0, bins: bins([0], [100_000], [4000]) }],
    { regions: [], bucket: 0, adapterKey: 'test-key' },
  )
  expect(display.regionTooLarge).toBe(true)
  expect(display.gateActive).toBe(true)
})

test('the band draws off the bins and the pileup uploads nothing', () => {
  const { display } = refusedDisplay({ withSource: true })
  display.setDensityBins(
    [
      {
        displayedRegionIndex: 0,
        bins: bins([0, 50_000], [50_000, 100_000], [1000, 4000]),
      },
    ],
    { regions: [], bucket: 0, adapterKey: 'test-key' },
  )
  const region = display.densityCoverageRegions.get(0)!
  expect(region.coveragePackedBuffer.byteLength).toBeGreaterThan(0)
  expect(region.coverageMaxDepth).toBeGreaterThan(0)
  // one bin per screen pixel at the debounced zoom
  expect(region.coverageBinSize).toBe(Math.round(display.view.coarseBpPerPx))
  // the axis is the bins' own count, not a read depth
  expect(display.coverageDomain).toEqual([0, region.coverageMaxDepth])
  // no lane, so every overlay that walks `renderSections` is empty too and the
  // one section the layout synthesizes uploads nothing
  expect(display.lanes).toEqual([])
  expect(display.sourceSections).toHaveLength(1)
  expect(display.sourceSections[0]!.laidOutPileupMap.size).toBe(0)
})

test('"features only" keeps the banner even with a source', () => {
  const { display } = refusedDisplay({ withSource: true })
  setConf(display, 'densityTier', 'features')
  expect(display.densityTierMode).toBe('features')
  expect(display.densityTierActive).toBe(false)
  expect(display.displayPhase).toBe('tooLarge')
})

test('the track menu offers the tri-state only where there is a source', () => {
  const withSource = refusedDisplay({ withSource: true }).display
  expect(
    withSource
      .trackMenuItems()
      .map(item => ('label' in item ? item.label : '')),
  ).toContain('Density tier')

  const without = refusedDisplay({ withSource: false }).display
  expect(
    without.trackMenuItems().map(item => ('label' in item ? item.label : '')),
  ).not.toContain('Density tier')
})

// `auto` reaches the tier through the gate's verdict, but the `density` mode is
// the user's override and can be in force with nothing refused at all — where
// the banner ranking never runs and the readiness has to travel as the
// `awaitingDependentData` hook instead.
test('a forced density tier stands in with no refusal at all', () => {
  const { display } = densityDisplay({ withSource: true, refused: false })
  setConf(display, 'densityTier', 'density')
  expect(display.regionTooLarge).toBe(false)
  expect(display.densityTierActive).toBe(true)
  // no lane, so every overlay that walks `renderSections` is empty too and the
  // one section the layout synthesizes uploads nothing
  expect(display.lanes).toEqual([])
  expect(display.sourceSections).toHaveLength(1)
  expect(display.sourceSections[0]!.laidOutPileupMap.size).toBe(0)
  expect(display.awaitingDependentData).toBe(true)

  display.setDensityBins(
    [{ displayedRegionIndex: 0, bins: bins([0], [100_000], [4000]) }],
    { regions: [], bucket: 0, adapterKey: 'test-key' },
  )
  expect(display.awaitingDependentData).toBe(false)
  expect(display.densityCoverageRegions.size).toBe(1)
})

describe('the band fetches nothing where the gate is not blocking', () => {
  it('suspends the read fetch under a forced mode, not under a refusal', () => {
    const { display } = densityDisplay({ withSource: true, refused: false })
    expect(display.fetchSuspended).toBe(false)

    setConf(display, 'densityTier', 'density')
    expect(display.fetchSuspended).toBe(true)

    stageByteEstimate(display, 1_500_000)
    expect(display.fetchSuspended).toBe(true)
  })

  it('keeps the measurement pass a refused auto owes', () => {
    const { display } = densityDisplay({ withSource: true, refused: false })
    setConf(display, 'densityTierBpPerPx', 1)
    expect(display.densityTierActive).toBe(true)
    expect(display.fetchSuspended).toBe(true)

    stageByteEstimate(display, 1_500_000)
    expect(display.fetchSuspended).toBe(false)
  })

  it('fetches the reads where the coverage band is hidden, since there is no band', () => {
    const { display } = densityDisplay({ withSource: true, refused: false })
    setConf(display, 'densityTier', 'density')
    expect(display.fetchSuspended).toBe(true)

    display.setShowCoverage(false)
    expect(display.densityBandActive).toBe(false)
    expect(display.fetchSuspended).toBe(false)
  })
})
