import { setConf } from '@jbrowse/core/configuration'
import { stageByteEstimate } from '@jbrowse/display-test-utils'

import { createTestEnvironment } from './testEnv.ts'

import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { MenuItem } from '@jbrowse/core/ui'

const DENSITY_ADAPTER = { type: 'BigWigAdapter', uri: 'segments.bw' }

// Refused on the byte axis, which is the only one this display runs: 8 Mb of
// index against the 5 Mb display config, at a span above the force-load floor.
function refusedDisplay(densityAdapter?: Record<string, unknown>) {
  const { display, view } = createTestEnvironment({
    densityAdapter,
  }).createDisplay()
  view.zoomTo(100)
  stageByteEstimate(display, 8_000_000)
  return { display, view }
}

function unrefusedDisplay(densityAdapter?: Record<string, unknown>) {
  const { display, view } = createTestEnvironment({
    densityAdapter,
  }).createDisplay()
  view.zoomTo(100)
  return { display, view }
}

function oneRow() {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    partitionValues: ['row0'],
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

const BINS: FeatureDensity = {
  starts: new Uint32Array([0, 100_000]),
  ends: new Uint32Array([100_000, 200_000]),
  scores: new Float32Array([40, 90]),
}

describe('the density tier stands in for the too-large banner', () => {
  it('keeps the banner where the adapter declares no density source', () => {
    const { display } = refusedDisplay()

    expect(display.regionTooLarge).toBe(true)
    expect(display.hasDensitySource).toBe(false)
    expect(display.densityTierActive).toBe(false)
    expect(display.displayPhase).toBe('tooLarge')
  })

  it('swaps to the band where it declares one', () => {
    const { display } = refusedDisplay(DENSITY_ADAPTER)

    expect(display.regionTooLarge).toBe(true)
    expect(display.densityTierActive).toBe(true)
    expect(display.displayPhase).not.toBe('tooLarge')
  })

  it('loads until the first read lands, then draws', () => {
    const { display } = refusedDisplay(DENSITY_ADAPTER)
    expect(display.displayPhase).toBe('loading')

    display.setDensityBins([{ displayedRegionIndex: 0, bins: BINS }], {
      regions: [],
      bucket: 0,
      adapterKey: 'k',
    })
    expect(display.displayPhase).toBe('ready')
    expect(display.densityBandActive).toBe(true)
    expect(display.densityBandLayer.maxDepth).toBeGreaterThan(0)
    // and the export paints its own body rather than the too-large note
    expect(display.drawsWhenTooLarge).toBe(true)
  })

  // Force-load clears the verdict, and the tier reads the verdict — so the
  // features the user asked for come back rather than the band standing over
  // them.
  it('gives the features back when the gate releases', () => {
    const { display } = refusedDisplay(DENSITY_ADAPTER)
    display.forceLoad()

    expect(display.regionTooLarge).toBe(false)
    expect(display.densityTierActive).toBe(false)
    expect(display.densityBandActive).toBe(false)
  })

  it('follows the densityTier slot over the verdict', () => {
    const { display } = refusedDisplay(DENSITY_ADAPTER)

    setConf(display, 'densityTier', 'features')
    expect(display.densityTierActive).toBe(false)
    expect(display.displayPhase).toBe('tooLarge')

    display.forceLoad()
    setConf(display, 'densityTier', 'density')
    expect(display.regionTooLarge).toBe(false)
    expect(display.densityTierActive).toBe(true)
  })
})

describe('the band stands alone, and fetches nothing', () => {
  it('empties what the painters and the sidebar read while holding what was loaded', () => {
    const { display } = unrefusedDisplay(DENSITY_ADAPTER)
    display.setRpcData(0, oneRow())
    expect(display.drawnRegionData.size).toBe(1)
    expect(display.fetchSuspended).toBe(false)

    setConf(display, 'densityTier', 'density')
    expect(display.drawnRegionData.size).toBe(0)
    expect(display.rpcDataMap.size).toBe(1)
    expect(display.fetchSuspended).toBe(true)
    expect(display.displayPhase).toBe('loading')
    expect(display.svgReady).toBe(false)

    display.setDensityBins([{ displayedRegionIndex: 0, bins: BINS }], {
      regions: [],
      bucket: 0,
      adapterKey: 'k',
    })
    expect(display.displayPhase).toBe('ready')
    expect(display.svgReady).toBe(true)
  })

  it('keeps the measurement pass where the gate is blocking', () => {
    const { display } = refusedDisplay(DENSITY_ADAPTER)
    expect(display.densityTierActive).toBe(true)
    expect(display.fetchSuspended).toBe(false)
  })
})

function trackMenuLabels(display: { trackMenuItems: () => MenuItem[] }) {
  return display.trackMenuItems().map(m => ('label' in m ? m.label : undefined))
}

test('the track menu offers the tier only where there is a source', () => {
  expect(trackMenuLabels(refusedDisplay().display)).not.toContain(
    'Density band',
  )
  expect(trackMenuLabels(refusedDisplay(DENSITY_ADAPTER).display)).toContain(
    'Density band',
  )
})
