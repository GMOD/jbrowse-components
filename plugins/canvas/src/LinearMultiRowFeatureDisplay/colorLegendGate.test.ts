import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { MenuItem } from '@jbrowse/core/ui'

function menuLabels(display: { trackMenuItems: () => MenuItem[] }): string[] {
  return display.trackMenuItems().flatMap(function labels(m): string[] {
    return [
      ...('label' in m && typeof m.label === 'string' ? [m.label] : []),
      ...('subMenu' in m ? resolveSubMenu(m).flatMap(labels) : []),
    ]
  })
}

const IDENTITY = {
  color: {
    scale: 'identity',
    domain: ['red', 'blue'],
    labels: ['EUR', 'AFR'],
  },
}

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
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// An identity scale's key is a claim about colors on the screen, so it has to
// answer the same "is anything painted" question the derived key answers by
// reading the data.
describe('the color key waits for a painting to key', () => {
  it('is empty before anything has loaded', () => {
    const { display } = createTestEnvironment({
      displayConfig: IDENTITY,
    }).createDisplay()

    expect(display.colorLegend).toHaveLength(0)
    expect(display.legendSpec.sections).toHaveLength(0)
  })

  it('carries the configured entries once features are drawn', () => {
    const { display } = createTestEnvironment({
      displayConfig: IDENTITY,
    }).createDisplay()
    display.setRpcData(0, painted(), ctgA)

    expect(display.colorLegend.map(e => e.label)).toEqual(['EUR', 'AFR'])
    expect(display.legendSpec.sections).toHaveLength(1)
  })

  it('lists the colors in domain order, under the heading Feature colors', () => {
    const { display } = createTestEnvironment({
      displayConfig: {
        color: {
          scale: 'identity',
          domain: ['green', 'red', 'blue'],
          labels: ['SAS', 'EUR', 'AFR'],
        },
      },
    }).createDisplay()
    display.setRpcData(0, painted(), ctgA)

    const [section] = display.legendSpec.sections
    expect(section!.items.map(i => i.label)).toEqual(['SAS', 'EUR', 'AFR'])
    expect(display.colorScales[0]!.title).toBe('Feature colors')
  })

  it('names a color the labels leave out by the color itself', () => {
    const { display } = createTestEnvironment({
      displayConfig: {
        color: { scale: 'identity', domain: ['red', 'blue'], labels: ['EUR'] },
      },
    }).createDisplay()
    display.setRpcData(0, painted(), ctgA)

    expect(display.colorLegend.map(e => e.label)).toEqual(['EUR', 'blue'])
  })

  it('keys nothing under a constant color, which paints no color of its own', () => {
    const { display } = createTestEnvironment({
      displayConfig: { color: { ...IDENTITY.color, value: 'orange' } },
    }).createDisplay()
    display.setRpcData(0, painted(), ctgA)

    expect(display.colorLegend).toHaveLength(0)
    expect(display.hasLegendKey).toBe(false)
  })

  it('keys the colors a jexl value paints', () => {
    const { display } = createTestEnvironment({
      displayConfig: {
        color: { ...IDENTITY.color, value: "jexl:get(feature,'color')" },
      },
    }).createDisplay()
    display.setRpcData(0, painted(), ctgA)

    expect(display.colorLegend.map(e => e.label)).toEqual(['EUR', 'AFR'])
  })

  it('hides the blocks painted in a key row it toggles off', () => {
    const { display } = createTestEnvironment({
      displayConfig: IDENTITY,
    }).createDisplay()
    display.setRpcData(0, painted(), ctgA)
    display.toggleCategory(display.colorLegend[0]!.values)

    expect([...display.hiddenColors]).toEqual([cssColorToABGR('red')])
  })

  it('drops it again while the density band stands in for the features', () => {
    const { display, view } = createTestEnvironment({
      densityAdapter: DENSITY_ADAPTER,
      displayConfig: IDENTITY,
    }).createDisplay()
    view.zoomTo(100)
    display.setRpcData(0, painted(), ctgA)
    expect(display.colorLegend).toHaveLength(2)

    setConf(display, 'densityTier', 'density')
    display.setCoarseTier([{ displayedRegionIndex: 0, payload: BINS }], {
      regions: [],
      key: 'k',
    })

    expect(display.coarseTierStandsIn).toBe(true)
    expect(display.colorLegend).toHaveLength(0)
    expect(display.legendSpec.sections).toHaveLength(0)
  })

  // The data gates the draw, never the toggle: a track waiting on its first
  // fetch must not lose the menu row that turns the key back on.
  it('keeps the "Show legend" toggle while nothing is painted', () => {
    const { display } = createTestEnvironment({
      displayConfig: IDENTITY,
    }).createDisplay()

    expect(display.legendSpec.sections).toHaveLength(0)
    expect(display.hasLegendKey).toBe(true)
    expect(menuLabels(display)).toContain('Show legend')
  })

  it('offers no toggle on a track that declares no key at all', () => {
    const { display } = createTestEnvironment().createDisplay()

    expect(display.hasLegendKey).toBe(false)
    expect(menuLabels(display)).not.toContain('Show legend')
  })

  it('is empty over a contig that came back with no features', () => {
    const { display } = createTestEnvironment({
      displayConfig: IDENTITY,
    }).createDisplay()
    display.setRpcData(
      0,
      {
        ...painted(),
        featureStarts: new Uint32Array(0),
        featureEnds: new Uint32Array(0),
        featureColors: new Uint32Array(0),
        partitionValues: [],
        featurePartitionIndex: new Uint32Array(0),
        featureNames: [],
        featureIds: [],
      },
      ctgA,
    )

    expect(display.colorLegend).toHaveLength(0)
  })
})
