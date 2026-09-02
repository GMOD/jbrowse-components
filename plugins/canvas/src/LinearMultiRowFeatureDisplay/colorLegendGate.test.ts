import { setConf } from '@jbrowse/core/configuration'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { MenuItem } from '@jbrowse/core/ui'

// The menu is one level of submenus deep ("Show..."), and the legend row lives
// inside it.
function menuLabels(display: { trackMenuItems: () => MenuItem[] }): string[] {
  return display.trackMenuItems().flatMap(function labels(m): string[] {
    return [
      ...('label' in m && typeof m.label === 'string' ? [m.label] : []),
      ...('subMenu' in m ? m.subMenu.flatMap(labels) : []),
    ]
  })
}

// An admin-declared key for an itemRgb ancestry painting: the categories are
// encoded in the block colors and nothing else names them.
const LEGEND = [
  { label: 'EUR', color: 'red' },
  { label: 'AFR', color: 'blue' },
]

const DENSITY_ADAPTER = { type: 'BigWigAdapter', uri: 'segments.bw' }

const BINS: FeatureDensity = {
  starts: new Uint32Array([0, 100_000]),
  ends: new Uint32Array([100_000, 200_000]),
  scores: new Float32Array([40, 90]),
}

function painted(): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array([100]),
    featureEnds: new Uint32Array([200]),
    featureColors: Uint32Array.from([cssColorToABGR('red')]),
    featureDeltas: new Int32Array(0),
    partitionValues: ['HG001'],
    featurePartitionIndex: new Uint32Array([0]),
    featureNames: ['EUR'],
    featureIds: ['f0'],
    usedItemRgb: true,
    partitionCandidates: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// The configured `legend` slot is a claim about colors on the screen, so it has
// to answer the same "is anything painted" question the derived key answers by
// reading the data. It did not, and the key drew over the density band, over
// the too-large banner, and over a track whose first fetch had not landed.
describe('the color key waits for a painting to key', () => {
  it('is empty before anything has loaded', () => {
    const { display } = createTestEnvironment({
      displayConfig: { legend: LEGEND },
    }).createDisplay()

    expect(display.colorLegend).toHaveLength(0)
    expect(display.hasLegendEntries).toBe(false)
  })

  it('carries the configured entries once features are drawn', () => {
    const { display } = createTestEnvironment({
      displayConfig: { legend: LEGEND },
    }).createDisplay()
    display.setRpcData(0, painted())

    expect(display.colorLegend.map(e => e.label)).toEqual(['EUR', 'AFR'])
    expect(display.hasLegendEntries).toBe(true)
  })

  it('drops it again while the density band stands in for the features', () => {
    const { display, view } = createTestEnvironment({
      densityAdapter: DENSITY_ADAPTER,
      displayConfig: { legend: LEGEND },
    }).createDisplay()
    view.zoomTo(100)
    display.setRpcData(0, painted())
    expect(display.colorLegend).toHaveLength(2)

    setConf(display, 'densityTier', 'density')
    display.setDensityBins([{ displayedRegionIndex: 0, bins: BINS }], 'k')

    expect(display.densityBandActive).toBe(true)
    expect(display.colorLegend).toHaveLength(0)
    expect(display.hasLegendEntries).toBe(false)
  })

  // The draw is what the data gates, never the toggle: the user configured a
  // key, and a track waiting on its first fetch — or standing behind the
  // density band — must not lose the menu row that turns it back on, nor the
  // promotable pin `PromotablePinCoverage` reaches through it.
  it('keeps the "Show legend" toggle while nothing is painted', () => {
    const { display } = createTestEnvironment({
      displayConfig: { legend: LEGEND },
    }).createDisplay()

    expect(display.hasLegendEntries).toBe(false)
    expect(display.hasLegendToShow).toBe(true)
    expect(menuLabels(display)).toContain('Show legend')
  })

  it('offers no toggle on a track that declares no key at all', () => {
    const { display } = createTestEnvironment().createDisplay()

    expect(display.hasLegendToShow).toBe(false)
    expect(menuLabels(display)).not.toContain('Show legend')
  })

  it('is empty over a contig that came back with no features', () => {
    const { display } = createTestEnvironment({
      displayConfig: { legend: LEGEND },
    }).createDisplay()
    display.setRpcData(0, {
      ...painted(),
      featureStarts: new Uint32Array(0),
      featureEnds: new Uint32Array(0),
      featureColors: new Uint32Array(0),
      partitionValues: [],
      featurePartitionIndex: new Uint32Array(0),
      featureNames: [],
      featureIds: [],
    })

    expect(display.colorLegend).toHaveLength(0)
  })
})
