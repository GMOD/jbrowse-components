import { INTERBASE_INSERTION, INTERBASE_SOFTCLIP } from '../../shared/types.ts'
import { computeVisibleLabels } from './computeVisibleLabels.ts'

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
    softclipBasePositions: new Uint32Array(),
    softclipBaseYs: new Uint16Array(),
    softclipBaseBases: new Uint8Array(),
    softclipBaseReadIndices: new Uint32Array(),
    ...overrides,
  } as PileupDataResult
}

// bpPerPx 0.1 → 10px/bp, so text renders (pxPerBp >= 6.5). bpToPx(bp) = bp*10.
function run(rpcData: PileupDataResult, bpPerPx = 0.1) {
  return computeVisibleLabels({
    view: {
      visibleRegions: [
        { displayedRegionIndex: 0, start: 0, end: 1000, screenStartPx: 0 },
      ],
      bpPerPx,
    },
    sections: [
      {
        laidOutPileupMap: { get: () => rpcData },
        topOffset: 0,
        pileupHeight: 1000,
      },
    ],
    height: 1000,
    featureHeight: 10,
    featureSpacing: 2,
    showMismatches: true,
    scrollTop: 0,
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

test('a collapsed section (pileupHeight 0) draws no labels', () => {
  const labels = computeVisibleLabels({
    view: {
      visibleRegions: [
        { displayedRegionIndex: 0, start: 0, end: 1000, screenStartPx: 0 },
      ],
      bpPerPx: 0.1,
    },
    sections: [
      {
        laidOutPileupMap: { get: () => makeRpcData(threeMismatches) },
        topOffset: 0,
        pileupHeight: 0,
      },
    ],
    height: 1000,
    featureHeight: 10,
    featureSpacing: 2,
    showMismatches: true,
    scrollTop: 0,
  })
  expect(labels).toHaveLength(0)
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

// A single deletion of length 100 spanning bp [0,100]; its on-screen width is
// 100/bpPerPx, so zooming out narrows it toward the "100" text width and fades.
const deletionLen100 = {
  gapPositions: new Uint32Array([0, 100]),
  gapYs: new Uint16Array([0]),
  gapLengths: new Uint16Array([100]),
  gapTypes: new Uint8Array([0]),
}

function deletionOpacity(bpPerPx: number) {
  const labels = run(makeRpcData(deletionLen100), bpPerPx).filter(
    l => l.type === 'deletion',
  )
  return labels[0]?.opacity
}

test('deletion label is fully opaque when the rect is far wider than its text', () => {
  // width 100/0.1 = 1000px >> text width
  expect(deletionOpacity(0.1)).toBe(1)
})

test('deletion label fades (partial opacity) as the rect narrows toward its text', () => {
  // width 100/4 = 25px, just above the ~16.6px text width for "100"
  const opacity = deletionOpacity(4)
  expect(opacity).toBeGreaterThan(0)
  expect(opacity).toBeLessThan(1)
})

test('deletion label drops out once the rect is no wider than its text', () => {
  // width 100/10 = 10px < text width for "100"
  expect(deletionOpacity(10)).toBeUndefined()
})

test('large insertion label fades as its on-screen span shrinks toward the large threshold', () => {
  // span 20*pxPerBp: opacity 1 at >=30px, partial in (15,30), gone below 15px
  const opacityAt = (bpPerPx: number) =>
    run(makeRpcData(largeInsertionAt10), bpPerPx).find(
      l => l.type === 'insertion',
    )?.opacity
  expect(opacityAt(0.1)).toBe(1) // span 200px
  const mid = opacityAt(1)
  expect(mid).toBeGreaterThan(0) // span 20px
  expect(mid).toBeLessThan(1)
})

// 'T' and 'G' clipped bases at pos 30/31 row 2 (show-soft-clipping data).
const softclipBasesAt30 = {
  softclipBasePositions: new Uint32Array([30, 31]),
  softclipBaseYs: new Uint16Array([2, 2]),
  softclipBaseBases: new Uint8Array([84, 71]),
}

test('soft-clip bases render per-base letters (as mismatch-colored text)', () => {
  expect(mismatchTexts(makeRpcData(softclipBasesAt30))).toEqual(['T', 'G'])
})

test('the (S<len>) summary is suppressed when per-base clip letters render', () => {
  const softclipInterbase = {
    interbasePositions: new Uint32Array([30]),
    interbaseYs: new Uint16Array([2]),
    interbaseLengths: new Uint16Array([2]),
    interbaseTypes: new Uint8Array([INTERBASE_SOFTCLIP]),
  }
  const labels = run(
    makeRpcData({ ...softclipInterbase, ...softclipBasesAt30 }),
  )
  expect(labels.filter(l => l.type === 'softclip')).toHaveLength(0)
  expect(
    mismatchTexts(makeRpcData({ ...softclipInterbase, ...softclipBasesAt30 })),
  ).toEqual(['T', 'G'])
})

test('the (S<len>) summary still renders when no per-base clip data', () => {
  const softclipInterbase = {
    interbasePositions: new Uint32Array([30]),
    interbaseYs: new Uint16Array([2]),
    interbaseLengths: new Uint16Array([5]),
    interbaseTypes: new Uint8Array([INTERBASE_SOFTCLIP]),
  }
  const labels = run(makeRpcData(softclipInterbase))
  expect(labels.filter(l => l.type === 'softclip').map(l => l.text)).toEqual([
    '(S5)',
  ])
})

test('a grouped section near the top of its band stays visible after scrolling', () => {
  // Group 2's pileup band starts at content-space topOffset 400; scrolling
  // down by 200px brings its row 0 (screen yPx ~205) into view at screen y
  // ~205, which must satisfy the lower bound topOffset - scrollTop (200), not
  // the unscrolled topOffset (400).
  const labels = computeVisibleLabels({
    view: {
      visibleRegions: [
        { displayedRegionIndex: 0, start: 0, end: 1000, screenStartPx: 0 },
      ],
      bpPerPx: 0.1,
    },
    sections: [
      {
        laidOutPileupMap: { get: () => undefined },
        topOffset: 0,
        pileupHeight: 0,
      },
      {
        laidOutPileupMap: { get: () => makeRpcData(threeMismatches) },
        topOffset: 400,
        pileupHeight: 1000,
      },
    ],
    height: 1000,
    featureHeight: 10,
    featureSpacing: 2,
    showMismatches: true,
    scrollTop: 200,
  })
  expect(labels.filter(l => l.type === 'mismatch')).toHaveLength(3)
})
