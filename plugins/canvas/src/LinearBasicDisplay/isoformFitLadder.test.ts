import { packStackedGenes } from '../RenderFeatureDataRPC/testUtils.ts'
import { solveIsoformCount, solveLabelRoomFactor } from './fitLadder.ts'
import { maxIsoformCount } from './isoformTrim.ts'
import {
  computeLaidOutData,
  createContentHeightProbe,
  createIsoformCountProbe,
} from './layout.ts'
import { maxBottom } from './layoutQueries.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LayoutInputs, LayoutRegionData } from './layoutInputs.ts'

const OPN4 = {
  featureId: 'OPN4',
  name: 'OPN4',
  startBp: 86_654_546,
  endBp: 86_666_460,
  isoforms: 4,
  strand: 1,
}
const LDB3 = {
  featureId: 'LDB3',
  name: 'LDB3',
  startBp: 86_666_787,
  endBp: 86_736_072,
  isoforms: 10,
  strand: -1,
}

const TRACK_HEIGHT = 145
const BP_PER_PX = 73.9

const REGIONS: ReadonlyMap<number, LayoutRegionData> = new Map([
  [0, { regionKey: 'hg38:chr10', ...packStackedGenes([OPN4, LDB3]) }],
])

const INPUTS: LayoutInputs = {
  bpPerPx: BP_PER_PX,
  showLabels: true,
  showDescriptions: false,
  reversedRegions: new Set<number>(),
  displayMode: 'normal',
  pinnedFeatureIds: new Set<string>(),
}

const laidOut = (maxIsoformsPerGene?: number) =>
  computeLaidOutData(REGIONS, { ...INPUTS, maxIsoformsPerGene })

const namesDrawn = (maxIsoformsPerGene?: number) =>
  [...laidOut(maxIsoformsPerGene).get(0)!.floatingLabelsData.values()]
    .map(label => label.nameLabel?.text)
    .filter(Boolean)

function isoformsDrawn(featureId: string, maxIsoformsPerGene?: number) {
  const data = laidOut(maxIsoformsPerGene).get(0)!
  const idx = data.flatbushItems.findIndex(i => i.featureId === featureId)
  const ordinals = new Set<number>()
  for (const [i, feature] of data.rectFeatureIndices.entries()) {
    if (feature === idx) {
      ordinals.add(data.rectChildOrdinals[i]!)
    }
  }
  return ordinals.size
}

const isoformProbe = createIsoformCountProbe(REGIONS, INPUTS)

describe('the isoform rung, on the shape that needed it', () => {
  it('overflows the track with every transcript drawn', () => {
    expect(maxBottom(laidOut())).toBeCloseTo(204)
    expect(namesDrawn()).toEqual(['OPN4', 'LDB3'])
  })

  it('has no name-keeping decimation to fall back on', () => {
    const decimated = createContentHeightProbe(REGIONS, {
      ...INPUTS,
      labelDecimation: 'fitWidth',
    })
    expect(solveLabelRoomFactor(decimated, TRACK_HEIGHT)).toBeUndefined()
  })

  it('solves a count that fits with the names kept', () => {
    const count = solveIsoformCount(isoformProbe, TRACK_HEIGHT, 10, 1)!
    expect(count).toBe(5)
    expect(isoformProbe(count)).toBeLessThanOrEqual(TRACK_HEIGHT)
    expect(isoformProbe(count + 1)).toBeGreaterThan(TRACK_HEIGHT)
  })

  it('keeps both names and trims the crowded gene', () => {
    const count = solveIsoformCount(isoformProbe, TRACK_HEIGHT, 10, 1)!
    expect(namesDrawn(count)).toEqual(['OPN4', 'LDB3'])
    expect(isoformsDrawn('LDB3', count)).toBeLessThanOrEqual(5)
    expect(isoformsDrawn('OPN4', count)).toBe(4)
    expect(maxBottom(laidOut(count))).toBeLessThanOrEqual(TRACK_HEIGHT)
  })

  it('tells the trimmed gene how many it is missing', () => {
    const count = solveIsoformCount(isoformProbe, TRACK_HEIGHT, 10, 1)!
    const labels = laidOut(count).get(0)!.floatingLabelsData
    expect(labels.get('LDB3')!.moreIsoformsLabel).toMatchObject({
      text: '+5 more',
      hidden: 5,
    })
    expect(labels.get('OPN4')!.moreIsoformsLabel).toBeUndefined()
  })

  it('is monotone in the count', () => {
    const heights = [1, 2, 3, 4, 5, 6, 8, 10].map(isoformProbe)
    expect(heights).toEqual([...heights].sort((a, b) => a - b))
  })

  it('answers one when even one per gene overflows', () => {
    expect(solveIsoformCount(isoformProbe, 20, 10, 1)).toBe(1)
    expect(solveIsoformCount(isoformProbe, 20, 10, undefined)).toBeUndefined()
  })

  it('answers nothing when the whole stack already fits', () => {
    expect(solveIsoformCount(isoformProbe, 400, 10, 1)).toBeUndefined()
  })

  it('never trims a gene the user opened', () => {
    const expanded = computeLaidOutData(REGIONS, {
      ...INPUTS,
      maxIsoformsPerGene: 5,
      expandedGeneIds: new Set(['LDB3']),
    }).get(0)!
    const idx = expanded.flatbushItems.findIndex(i => i.featureId === 'LDB3')
    const ordinals = new Set<number>()
    for (const [i, feature] of expanded.rectFeatureIndices.entries()) {
      if (feature === idx) {
        ordinals.add(expanded.rectChildOrdinals[i]!)
      }
    }
    expect(ordinals.size).toBe(10)
    expect(
      expanded.floatingLabelsData.get('LDB3')!.moreIsoformsLabel,
    ).toMatchObject({ text: 'show fewer', expanded: true })
  })
})

describe('the isoform rung with every stacked gene expanded', () => {
  const expandedGeneIds = new Set(['OPN4', 'LDB3'])
  const probe = createIsoformCountProbe(REGIONS, { ...INPUTS, expandedGeneIds })

  it('measures the same overflowing height at every count', () => {
    expect(probe(1)).toBe(probe(10))
    expect(probe(1)).toBeGreaterThan(TRACK_HEIGHT)
  })

  it('leaves no gene to count, so there is nothing to solve', () => {
    const top = maxIsoformCount(REGIONS.values(), undefined, expandedGeneIds)
    expect(top).toBe(0)
    expect(solveIsoformCount(probe, TRACK_HEIGHT, top, 1)).toBeUndefined()
  })

  it('reports no trim on the display', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setGeneGlyphMode('auto')
    display.setRpcData(
      0,
      packStackedGenes([
        { featureId: 'gene1', startBp: 0, endBp: 5000, isoforms: 10 },
        { featureId: 'gene2', startBp: 4000, endBp: 9000, isoforms: 4 },
      ]),
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 },
    )
    display.setHeightMode('fit')
    display.setHeight(30)
    expect(display.fitStage.maxIsoforms).toBe(1)
    expect(display.geneGlyphCollapsed).toBe(true)
    display.toggleExpandedGene('gene1')
    display.toggleExpandedGene('gene2')
    expect(display.fitStage.maxIsoforms).toBeUndefined()
    expect(display.geneGlyphIsoformCap).toBeUndefined()
    expect(display.geneGlyphCollapsed).toBe(false)
  })
})
