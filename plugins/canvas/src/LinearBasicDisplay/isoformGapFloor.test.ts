import {
  snapBoxHeightPx,
  snapBoxTopPx,
} from '@jbrowse/render-core/shaders/hpmath'

import { packStackedGenes } from '../RenderFeatureDataRPC/testUtils.ts'
import { computeLaidOutData } from './layout.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { StackedGeneSpec } from '../RenderFeatureDataRPC/testUtils.ts'
import type { LayoutInputs, LayoutRegionData } from './layout.ts'

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

// Every rect as the renderer paints it: whole pixel rows, through the same two
// snapping rules both backends draw by (rect.slang's vs_main). The gap a reader
// sees is between these, never between the float Ys the layout holds.
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

// The whole point: at superCompact's 0.3 scale the worker's proportional gap is
// 0.6px, which the row snapping rounds into a pixel of air for one pair of rows
// and none for the next — three isoforms drawn as one solid bar.
test.each([
  ['normal', 10],
  ['compact', 10],
  ['superCompact', 10],
  // A `featureHeight` whose superCompact box (2.4px) is nudged UP to 3px by the
  // odd-height rule, so a floor written as "gap >= 1" would still let the rows
  // touch. The floor is a pitch for that reason.
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

// The floor is a floor: where the worker's own gap already clears it, the rows
// stay exactly where the worker put them, so normal mode is not quietly
// loosened by a rule written for superCompact.
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

// The pack prices the spread through `isoformGapSpreadPx` and the render pass
// spends it through `applyIsoformGapFloor`. If the two ever disagree the gene
// grows into the row below it, which is the one thing worse than the merged
// bar this fixes.
test('the row a spread gene is given covers what it draws', () => {
  const data = laidOut('superCompact', [
    GENE,
    { featureId: 'gene2', startBp: 0, endBp: 1000, isoforms: 2 },
  ])
  const first = drawnBoxes(data, 'gene1')
  const second = drawnBoxes(data, 'gene2')
  const lastDrawn = Math.max(...first.map(box => box.bottom))
  expect(Math.min(...second.map(box => box.top))).toBeGreaterThanOrEqual(
    lastDrawn + 1,
  )
})
