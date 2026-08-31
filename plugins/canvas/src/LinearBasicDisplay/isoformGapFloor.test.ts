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

// `featureHeight` is a per-feature callback slot, so a transcript can resolve a
// taller box than the gene that stacks it. Priced off the gene's box alone, the
// 2.4px/3.6px pair below spread by 1.12px onto a 4.0px pitch — and a 3.6px box
// draws 5px (the odd-height nudge), so the pair still merged.
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

// The pitch each pair needs is its own, so one number per gene cannot be right:
// the 3px box over the 5px one needs 1.52px more than the worker gave, the 5px
// box over the 6px one 1.22px.
test('each gap is priced from the pair of boxes it separates', () => {
  const stack = packStackedGenes([
    { ...GENE, heightPx: 8, childHeightsPx: [8, 12, 20] },
  ]).flatbushItems[0]!.isoformStack!
  const extras = isoformGapExtrasPx(stack, 0.3, undefined)
  expect(extras[0]).toBeCloseTo(1.52, 2)
  expect(extras[1]).toBeCloseTo(1.22, 2)
  expect(isoformGapSpreadPx(stack, 0.3, undefined)).toBeCloseTo(2.74, 2)
})

// The pack prices the spread through `isoformGapSpreadPx` and the render pass
// spends it through `applyIsoformGapFloor`. If the two ever disagree the gene
// grows into the row below it, which is the one thing worse than the merged
// bar this fixes. Ten rows at a `featureHeight` the floor spreads by ~1.1px
// each, because the packer quantizes row tops to a pitch of a few px — a
// shallower stack rounds the priced and the unpriced row to the same count and
// the assertion then holds however wrong the price is.
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
