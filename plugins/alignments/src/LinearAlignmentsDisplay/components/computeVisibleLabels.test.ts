import { computeVisibleLabels } from './computeVisibleLabels.ts'
import { INTERBASE_INSERTION } from '../../shared/types.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  return {
    gapPositions: new Uint32Array(),
    gapYs: new Uint16Array(),
    gapLengths: new Uint16Array(),
    gapTypes: new Uint8Array(),
    interbasePositions: new Uint32Array(),
    interbaseYs: new Uint16Array(),
    interbaseLengths: new Uint16Array(),
    interbaseTypes: new Uint8Array(),
    mismatchPositions: new Uint32Array(),
    mismatchYs: new Uint16Array(),
    mismatchBases: new Uint8Array(),
    ...overrides,
  } as PileupDataResult
}

// bpPerPx 0.1 → 10px/bp, so text renders (pxPerBp >= 6.5). bpToPx(bp) = bp*10.
function run(rpcData: PileupDataResult) {
  return computeVisibleLabels({
    view: {
      visibleRegions: [
        { displayedRegionIndex: 0, start: 0, end: 1000, screenStartPx: 0 },
      ],
      bpPerPx: 0.1,
    },
    laidOutPileupMap: { get: () => rpcData },
    height: 1000,
    featureHeightSetting: 10,
    featureSpacing: 2,
    showMismatches: true,
    topOffset: 0,
    rangeY: [0, 1000],
  })
}

// A length-20 insertion is "large": box width = textWidthForNumber(20) = 22,
// centered on its bp. At pos 10 (xPx 100) it spans screen-x [89, 111].
const largeInsertionAt10 = {
  interbasePositions: new Uint32Array([10]),
  interbaseYs: new Uint16Array([0]),
  interbaseLengths: new Uint16Array([20]),
  interbaseTypes: new Uint8Array([INTERBASE_INSERTION]),
}

// 'A' at pos 10 row 0 (under the box), 'C' at pos 20 row 0 (outside the box),
// 'G' at pos 10 row 1 (under the box's x but a different row).
const threeMismatches = {
  mismatchPositions: new Uint32Array([10, 20, 10]),
  mismatchYs: new Uint16Array([0, 0, 1]),
  mismatchBases: new Uint8Array([65, 67, 71]),
}

function mismatchTexts(rpcData: PileupDataResult) {
  return run(rpcData)
    .filter(l => l.type === 'mismatch')
    .map(l => l.text)
}

test('large insertion shadows the SNP letter on its own row only', () => {
  expect(
    mismatchTexts(makeRpcData({ ...largeInsertionAt10, ...threeMismatches })),
  ).toEqual(['C', 'G'])
})

test('without the insertion all three SNP letters render', () => {
  expect(mismatchTexts(makeRpcData(threeMismatches))).toEqual(['A', 'C', 'G'])
})

test('the large insertion still emits its own length label', () => {
  const labels = run(makeRpcData({ ...largeInsertionAt10, ...threeMismatches }))
  expect(labels.filter(l => l.type === 'insertion').map(l => l.text)).toEqual([
    '20',
  ])
})
