import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { stageByteEstimate } from '@jbrowse/display-test-utils'

import {
  makeFeatureData,
  makeFlatbushItem,
  packFixtureRects,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { MenuItem } from '@jbrowse/core/ui'

const DENSITY_ADAPTER = { type: 'BigWigAdapter', uri: 'features.bw' }

// `adapterFetchSizeLimit` is huge so the byte axis stays quiet until a test
// hands it an estimate, and the density axis until a test hands it counts.
function refusableDisplay(densityAdapter?: Record<string, unknown>) {
  const env = createTestEnvironment({
    adapterFetchSizeLimit: 50_000_000,
    densityAdapter,
  })
  const { display, view } = env.createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
  ])
  view.zoomTo(62.5)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  return { display, view }
}

function refuseOnBytes(display: RefusableDisplay) {
  stageByteEstimate(display, 400_000_000)
}

type RefusableDisplay = ReturnType<typeof refusableDisplay>['display']

const BINS: FeatureDensity = {
  starts: new Uint32Array([0, 12_700]),
  ends: new Uint32Array([12_700, 25_400]),
  scores: new Float32Array([3000, 5000]),
}

describe('the density tier stands in for the too-large banner', () => {
  it('keeps the banner where the adapter declares no density source', () => {
    const { display } = refusableDisplay()
    refuseOnBytes(display)

    expect(display.regionTooLarge).toBe(true)
    expect(display.hasCoarseSource).toBe(false)
    expect(display.coarseTierActive).toBe(false)
    expect(display.displayPhase).toBe('tooLarge')
  })

  it('swaps to the band where it declares one', () => {
    const { display } = refusableDisplay(DENSITY_ADAPTER)
    refuseOnBytes(display)

    expect(display.regionTooLarge).toBe(true)
    expect(display.coarseTierActive).toBe(true)
    expect(display.displayPhase).not.toBe('tooLarge')
  })

  it('swaps on the density axis too', () => {
    const { display } = refusableDisplay(DENSITY_ADAPTER)
    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 25_400 },
          result: { featureCount: 5000 },
        },
      ],
      display.gateFetchState(),
    )

    expect(display.densityTooLarge).toBe(true)
    expect(display.regionTooLarge).toBe(true)
    expect(display.coarseTierActive).toBe(true)
    expect(display.displayPhase).not.toBe('tooLarge')
  })

  it('loads until the first read lands, then draws', () => {
    const { display } = refusableDisplay(DENSITY_ADAPTER)
    refuseOnBytes(display)
    expect(display.displayPhase).toBe('loading')

    display.setCoarseTier([{ displayedRegionIndex: 0, payload: BINS }], {
      regions: [],
      key: 'k',
    })
    expect(display.displayPhase).toBe('ready')
    expect(display.coarseTierStandsIn).toBe(true)
    expect(display.densityBandLayer.maxDepth).toBeGreaterThan(0)
    expect(display.drawsWhenTooLarge).toBe(true)
  })

  it('reads the value under the cursor at the current zoom', () => {
    const { display, view } = refusableDisplay(DENSITY_ADAPTER)
    refuseOnBytes(display)
    display.setCoarseTier([{ displayedRegionIndex: 0, payload: BINS }], {
      regions: [],
      key: 'k',
    })
    const px = 400
    const under = view.pxToBp(px).coord0
    expect(under).toBeLessThan(12_700)

    display.setDensityHoverPx(px)
    expect(display.densityHover).toEqual({ displayedRegionIndex: 0, bp: under })
    expect(display.densityReadout).toMatch(/^3000 at cursor/)

    view.zoomTo(view.bpPerPx / 4)
    const zoomed = view.pxToBp(px).coord0
    expect(zoomed).not.toBe(under)
    expect(display.densityHover).toEqual({
      displayedRegionIndex: 0,
      bp: zoomed,
    })

    display.setDensityHoverPx(undefined)
    expect(display.densityHover).toBeUndefined()
  })

  it('reports a failed read as an error, not an endless scrim', () => {
    const { display } = refusableDisplay(DENSITY_ADAPTER)
    refuseOnBytes(display)
    expect(display.displayPhase).toBe('loading')

    display.setError(new Error('sidecar 404'))
    expect(display.displayPhase).toBe('error')
    expect(display.svgReady).toBe(true)
  })

  it('keeps the banner where the slot holds no adapter config', () => {
    const { display } = refusableDisplay({ uri: 'genes.density.bw' })
    refuseOnBytes(display)

    expect(display.hasCoarseSource).toBe(false)
    expect(display.coarseTierActive).toBe(false)
    expect(display.displayPhase).toBe('tooLarge')
  })

  it('follows the densityTier slot over the verdict', () => {
    const { display } = refusableDisplay(DENSITY_ADAPTER)

    expect(display.regionTooLarge).toBe(false)
    expect(display.coarseTierActive).toBe(false)

    setConf(display, 'densityTier', 'density')
    expect(display.coarseTierActive).toBe(true)

    refuseOnBytes(display)
    setConf(display, 'densityTier', 'features')
    expect(display.coarseTierActive).toBe(false)
    expect(display.displayPhase).toBe('tooLarge')
  })
})

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 50_000,
  assemblyName: 'volvox',
}

function loadFeatures(display: RefusableDisplay) {
  const spans = [
    { startBp: 1000, endBp: 2000 },
    { startBp: 5000, endBp: 6000 },
  ]
  display.setRpcData(
    0,
    makeFeatureData({
      ...packFixtureRects(spans),
      flatbushItems: spans.map((span, i) =>
        makeFlatbushItem({
          featureId: `f${i}`,
          ...span,
          topPx: 0,
          bottomPx: 10,
        }),
      ),
      featureCount: spans.length,
    }),
    REGION,
  )
}

describe('the band stands alone, and fetches nothing', () => {
  it('empties what the painters read while holding what was loaded', () => {
    const { display } = refusableDisplay(DENSITY_ADAPTER)
    loadFeatures(display)
    expect(display.laidOutDataMap.size).toBe(1)

    setConf(display, 'densityTier', 'density')
    expect(display.laidOutDataMap.size).toBe(0)
    expect(display.rpcDataMap.size).toBe(1)

    setConf(display, 'densityTier', 'features')
    expect(display.laidOutDataMap.size).toBe(1)
  })

  it('suspends the feature fetch under a forced density, refused or not', () => {
    const { display } = refusableDisplay(DENSITY_ADAPTER)
    expect(display.fetchSuspended).toBe(false)

    setConf(display, 'densityTier', 'density')
    expect(display.fetchSuspended).toBe(true)

    refuseOnBytes(display)
    expect(display.fetchSuspended).toBe(true)
  })

  it('keeps the measurement pass a refused auto owes', () => {
    const { display } = refusableDisplay(DENSITY_ADAPTER)
    setConf(display, 'densityTierBpPerPx', 1)
    expect(display.coarseTierActive).toBe(true)
    expect(display.fetchSuspended).toBe(true)

    refuseOnBytes(display)
    expect(display.fetchSuspended).toBe(false)
  })

  it('waits on the band, for the phase and for the export', () => {
    const { display } = refusableDisplay(DENSITY_ADAPTER)
    setConf(display, 'densityTier', 'density')
    expect(display.regionTooLarge).toBe(false)
    expect(display.displayPhase).toBe('loading')
    expect(display.svgReady).toBe(false)

    display.setCoarseTier([{ displayedRegionIndex: 0, payload: BINS }], {
      regions: [],
      key: 'k',
    })
    expect(display.displayPhase).toBe('ready')
    expect(display.svgReady).toBe(true)
  })
})

function trackMenuLabels(display: { trackMenuItems: () => MenuItem[] }) {
  return display.trackMenuItems().map(m => ('label' in m ? m.label : undefined))
}

test('the track menu offers the tier only where there is a source', () => {
  expect(trackMenuLabels(refusableDisplay().display)).not.toContain(
    'Density band',
  )
  expect(trackMenuLabels(refusableDisplay(DENSITY_ADAPTER).display)).toContain(
    'Density band',
  )
})

function densityBandItems(display: { trackMenuItems: () => MenuItem[] }) {
  const band = display
    .trackMenuItems()
    .find(m => 'label' in m && m.label === 'Density band')
  return band && 'subMenu' in band ? resolveSubMenu(band) : []
}

test("the band carries the banner's force-load while it stands in for a refusal", () => {
  const { display } = refusableDisplay(DENSITY_ADAPTER)
  const labels = () =>
    densityBandItems(display).map(m => ('label' in m ? m.label : undefined))
  expect(labels()).not.toContain('Load features anyway (may be slow)')

  refuseOnBytes(display)
  expect(labels()).toContain('Load features anyway (may be slow)')

  setConf(display, 'densityTier', 'density')
  expect(labels()).not.toContain('Load features anyway (may be slow)')

  setConf(display, 'densityTier', 'auto')
  const load = densityBandItems(display).find(
    m => 'label' in m && m.label === 'Load features anyway (may be slow)',
  )!
  if ('onClick' in load) {
    load.onClick({})
  }
  expect(display.regionTooLarge).toBe(false)
  expect(display.coarseTierActive).toBe(false)
})
