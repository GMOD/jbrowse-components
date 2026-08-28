import { packStackedGenes } from '../RenderFeatureDataRPC/testUtils.ts'
import { solveIsoformCount, solveLabelRoomFactor } from './fitLadder.ts'
import {
  computeLaidOutData,
  createContentHeightProbe,
  createIsoformCountProbe,
  maxBottom,
} from './layout.ts'

import type { LayoutInputs, LayoutRegionData } from './layout.ts'

// The shape the isoform rung was built for, from the session that found the bug
// (share-oW8eg4-TTT, NCBI RefSeq hg38 chr10:86,656,837..86,755,086 in a 145px
// fitted track). OPN4 and LDB3 are 327bp apart — about 4.4px at this zoom — so
// the worker's own pre-fetch arithmetic gave LDB3 the whole lane and handed it
// all 10 transcripts. The main-thread packer then put it UNDER OPN4 anyway,
// because a strand arrow is 8px of layout width the worker never sees, and the
// labelled stack came out 204px in a 145px track.
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

// Isoforms of one gene still on screen, counted off the rects rather than off
// the trim that produced them — a trim that filtered the wrong lane would leave
// this number right and the picture wrong.
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
  // The measured `labels` rung: OPN4 0-62, LDB3 70-204. Both names, 59px of
  // overflow, and nothing left to give but the names themselves.
  it('overflows the track with every transcript drawn', () => {
    expect(maxBottom(laidOut())).toBeCloseTo(204)
    expect(namesDrawn()).toEqual(['OPN4', 'LDB3'])
  })

  // What the ladder used to do instead: no factor keeps a name and fits, so it
  // fell through `decimated` to `bodies` and the user saw ten transcripts with
  // nothing naming the gene they belong to. This is the rung's sabotage — skip
  // it and the names go.
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
    // OPN4 has four and the count is five, so it is left alone
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

  // Fewer transcripts can only make a stack shorter, which is what lets the
  // solve bisect at all.
  it('is monotone in the count', () => {
    const heights = [1, 2, 3, 4, 5, 6, 8, 10].map(isoformProbe)
    expect(heights).toEqual([...heights].sort((a, b) => a - b))
  })

  // A track too short for even one transcript per gene still answers 1 for fit
  // mode, so the `decimated` and `bodies` rungs below run there rather than back
  // at the full stack: every isoform goes before any name does. Fixed mode has
  // no rung below and so declines the trim — see the display-level case in
  // fitToDisplayHeight.test.ts.
  it('answers one when even one per gene overflows', () => {
    expect(solveIsoformCount(isoformProbe, 20, 10, 1)).toBe(1)
    expect(solveIsoformCount(isoformProbe, 20, 10, undefined)).toBeUndefined()
  })

  it('answers nothing when the whole stack already fits', () => {
    expect(solveIsoformCount(isoformProbe, 400, 10, 1)).toBeUndefined()
  })

  // An expanded gene is the user's own request for the full stack, so the count
  // does not apply to it — and the badge on it says so.
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
