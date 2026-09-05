import {
  snapBoxHeightPx,
  snapBoxTopPx,
} from '@jbrowse/render-core/shaders/hpmath'

import { packStackedGenes } from '../RenderFeatureDataRPC/testUtils.ts'
import { isoformGapExtrasPx, isoformGapSpreadPx } from './isoformGapFloor.ts'
import { computeLaidOutData } from './layout.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { StackedGeneSpec } from '../RenderFeatureDataRPC/testUtils.ts'
import type { LayoutInputs, LayoutRegionData } from './layoutInputs.ts'

const INPUTS: LayoutInputs = {
  bpPerPx: 1,
  showLabels: false,
  showDescriptions: false,
  reversedRegions: new Set<number>(),
  displayMode: 'normal',
  pinnedFeatureIds: new Set<string>(),
}

function laidOut(displayMode: DisplayMode, genes: StackedGeneSpec[]) {
  const regions: ReadonlyMap<number, LayoutRegionData> = new Map([
    [0, { regionKey: 'v:ctgA', ...packStackedGenes(genes) }],
  ])
  return computeLaidOutData(regions, { ...INPUTS, displayMode }).get(0)!
}

function drawnBoxes(data: FeatureDataResult, featureId: string) {
  return [...data.rectYs]
    .map((y, i) => {
      const heightPx = data.rectHeights[i]!
      const top = snapBoxTopPx(y, heightPx, 0)
      return {
        featureId: data.flatbushItems[data.rectFeatureIndices[i]!]!.featureId,
        top,
        bottom: top + snapBoxHeightPx(heightPx),
      }
    })
    .filter(box => box.featureId === featureId)
    .sort((a, b) => a.top - b.top)
}

function rowGaps(data: FeatureDataResult, featureId: string) {
  const boxes = drawnBoxes(data, featureId)
  return boxes.slice(1).map((box, i) => box.top - boxes[i]!.bottom)
}

const GENE: StackedGeneSpec = {
  featureId: 'gene1',
  startBp: 0,
  endBp: 1000,
  isoforms: 3,
}

test.each([
  ['normal', 10],
  ['compact', 10],
  ['superCompact', 10],
  ['superCompact', 8],
  ['collapsed', 10],
] as [DisplayMode, number][])(
  'a %s gene at featureHeight %i keeps a pixel between its transcripts',
  (displayMode, heightPx) => {
    const data = laidOut(displayMode, [{ ...GENE, heightPx }])
    const gaps = rowGaps(data, 'gene1')
    expect(gaps).toHaveLength(2)
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(1)
    }
  },
)

test.each([
  ['normal', 12],
  ['compact', 7.2],
] as [DisplayMode, number][])(
  'a %s gene stacks at its own pitch',
  (displayMode, pitchPx) => {
    const data = laidOut(displayMode, [GENE])
    const boxes = [...data.rectYs].sort((a, b) => a - b)
    expect(boxes[1]! - boxes[0]!).toBeCloseTo(pitchPx)
    expect(boxes[2]! - boxes[1]!).toBeCloseTo(pitchPx)
  },
)

test('a gene whose transcripts resolve their own heights keeps every pixel', () => {
  const data = laidOut('superCompact', [
    { ...GENE, heightPx: 8, childHeightsPx: [8, 12, 20] },
  ])
  const gaps = rowGaps(data, 'gene1')
  expect(gaps).toHaveLength(2)
  for (const gap of gaps) {
    expect(gap).toBeGreaterThanOrEqual(1)
  }
})

test('each gap is priced from the pair of boxes it separates', () => {
  const stack = packStackedGenes([
    { ...GENE, heightPx: 8, childHeightsPx: [8, 12, 20] },
  ]).flatbushItems[0]!.isoformStack!
  const extras = isoformGapExtrasPx(stack, 0.3, undefined)
  expect(extras[0]).toBeCloseTo(1.52, 2)
  expect(extras[1]).toBeCloseTo(1.22, 2)
  expect(isoformGapSpreadPx(stack, 0.3, undefined)).toBeCloseTo(2.74, 2)
})

// Ten rows, because the packer quantizes row tops to a pitch of a few px: a
// shallower stack rounds the priced and the unpriced row to the same count
// and the assertion holds however wrong the price is.
test('the row a spread gene is given covers what it draws', () => {
  const data = laidOut('superCompact', [
    { ...GENE, heightPx: 8, isoforms: 10 },
    { featureId: 'gene2', startBp: 0, endBp: 1000, isoforms: 2, heightPx: 8 },
  ])
  const first = drawnBoxes(data, 'gene1')
  const second = drawnBoxes(data, 'gene2')
  expect(first).toHaveLength(10)
  const lastDrawn = Math.max(...first.map(box => box.bottom))
  expect(Math.min(...second.map(box => box.top))).toBeGreaterThanOrEqual(
    lastDrawn + 1,
  )
})
