import { measureText } from '@jbrowse/core/util'

import { INTERBASE_INSERTION, INTERBASE_SOFTCLIP } from '../../shared/types.ts'
import {
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_LABEL_OPACITY,
  computeLabelFontSize,
  labelFadeOpacity,
} from '../constants.ts'
import { computeVisibleLabels } from './computeVisibleLabels.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  return {
    gapPositions: new Uint32Array(),
    gapYs: new Uint16Array(),
    gapLengths: new Uint32Array(),
    gapTypes: new Uint8Array(),
    interbasePositions: new Uint32Array(),
    interbaseYs: new Uint16Array(),
    interbaseLengths: new Uint32Array(),
    interbaseTypes: new Uint8Array(),
    mismatchPositions: new Uint32Array(),
    mismatchYs: new Uint16Array(),
    mismatchBases: new Uint8Array(),
    mismatchQuals: new Uint8Array(),
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
    mismatchAlpha: false,
    scrollTop: 0,
  })
}

// A length-20 insertion is "large": box width = textWidthForNumber(20) = 22,
// centered on its bp. At pos 10 (xPx 100) it spans screen-x [89, 111].
const largeInsertionAt10 = {
  interbasePositions: new Uint32Array([10]),
  interbaseYs: new Uint16Array([0]),
  interbaseLengths: new Uint32Array([20]),
  interbaseTypes: new Uint8Array([INTERBASE_INSERTION]),
}

// 'A' at pos 10 row 0 (under the box), 'C' at pos 20 row 0 (outside the box),
// 'G' at pos 10 row 1 (under the box's x but a different row).
const threeMismatches = {
  mismatchPositions: new Uint32Array([10, 20, 10]),
  mismatchYs: new Uint16Array([0, 0, 1]),
  mismatchBases: new Uint8Array([65, 67, 71]),
  // Phred 60, past mismatch.slang's OPAQUE_QUAL, so the quality fade is inert
  // in every test that doesn't set out to exercise it.
  mismatchQuals: new Uint8Array([60, 60, 60]),
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
    mismatchAlpha: false,
    scrollTop: 0,
  })
  expect(labels).toHaveLength(0)
})

test('without the insertion all three SNP letters render', () => {
  expect(mismatchTexts(makeRpcData(threeMismatches))).toEqual(['A', 'C', 'G'])
})

// "Fade low quality mismatches" fades the SNP box (drawMismatches /
// mismatch.slang). The letter drawn on top has to fade with it, or the setting
// is a no-op at the only zoom letters appear at.
describe('SNP letters carry the per-base quality fade', () => {
  const qualLabels = (mismatchAlpha: boolean) =>
    computeVisibleLabels({
      view: {
        visibleRegions: [
          { displayedRegionIndex: 0, start: 0, end: 1000, screenStartPx: 0 },
        ],
        bpPerPx: 0.1,
      },
      sections: [
        {
          laidOutPileupMap: {
            get: () =>
              makeRpcData({
                mismatchPositions: new Uint32Array([10, 20, 30, 40]),
                mismatchYs: new Uint16Array([0, 0, 0, 0]),
                mismatchBases: new Uint8Array([65, 67, 71, 84]),
                // Phred 60 (opaque), 25 (half), 0 (no quality => opaque), 1
                // (0.02, under MIN_LABEL_OPACITY)
                mismatchQuals: new Uint8Array([60, 25, 0, 1]),
              }),
          },
          topOffset: 0,
          pileupHeight: 1000,
        },
      ],
      height: 1000,
      featureHeight: 10,
      featureSpacing: 2,
      showMismatches: true,
      mismatchAlpha,
      scrollTop: 0,
    }).filter(l => l.type === 'mismatch')

  test('off: every letter is opaque whatever its quality', () => {
    expect(qualLabels(false).map(l => [l.text, l.opacity])).toEqual([
      ['A', 1],
      ['C', 1],
      ['G', 1],
      ['T', 1],
    ])
  })

  test('on: the letter takes the same qual/50 ramp its box does', () => {
    // The Phred-1 letter is under MIN_LABEL_OPACITY and drops out entirely
    // rather than costing a fillText for an invisible glyph.
    expect(qualLabels(true).map(l => [l.text, l.opacity])).toEqual([
      ['A', 1],
      ['C', 0.5],
      ['G', 1],
    ])
  })
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
  gapLengths: new Uint32Array([100]),
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

// A deletion wider than the view has its own midpoint off-screen, and a label
// placed there is simply not on the canvas — so the length is measured and
// placed against the visible part of the rect instead. Its own runner, because
// the region has to start away from bp 0 for a deletion to overhang BOTH edges.
describe('a deletion wider than the view labels its visible part', () => {
  // bp [10000,11000] at 1 bp/px => screen [0,1000]px; bpToPx(bp) = bp - 10000.
  const deletionLabel = (start: number, end: number) =>
    computeVisibleLabels({
      view: {
        visibleRegions: [
          {
            displayedRegionIndex: 0,
            start: 10000,
            end: 11000,
            screenStartPx: 0,
          },
        ],
        bpPerPx: 1,
      },
      sections: [
        {
          laidOutPileupMap: {
            get: () =>
              makeRpcData({
                gapPositions: new Uint32Array([start, end]),
                gapYs: new Uint16Array([0]),
                gapLengths: new Uint32Array([end - start]),
                gapTypes: new Uint8Array([0]),
              }),
          },
          topOffset: 0,
          pileupHeight: 1000,
        },
      ],
      height: 1000,
      featureHeight: 10,
      featureSpacing: 2,
      showMismatches: true,
      mismatchAlpha: false,
      scrollTop: 0,
    }).find(l => l.type === 'deletion')

  test('enclosing the whole view: label sits at the middle of the screen', () => {
    // A 50kb deletion over a 1kb view. Unclamped this landed at x=20000.
    const label = deletionLabel(5000, 55000)
    expect(label?.text).toBe('50000')
    expect(label?.x).toBeCloseTo(500)
    expect(label?.opacity).toBe(1)
  })

  test('running off the right edge: label centers in what is visible', () => {
    // Visible span is bp [10500,11000] => screen [500,1000], midpoint 750.
    expect(deletionLabel(10500, 12500)?.x).toBeCloseTo(750)
  })

  test('running off the left edge: label centers in what is visible', () => {
    // Visible span is bp [10000,10300] => screen [0,300], midpoint 150.
    expect(deletionLabel(9000, 10300)?.x).toBeCloseTo(150)
  })

  test('only a sliver visible: the label drops rather than jamming the edge', () => {
    // 8px of a 20kb deletion is nowhere near enough for "20000".
    expect(deletionLabel(10992, 30992)).toBeUndefined()
  })
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
    interbaseLengths: new Uint32Array([2]),
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
    interbaseLengths: new Uint32Array([5]),
    interbaseTypes: new Uint8Array([INTERBASE_SOFTCLIP]),
  }
  const labels = run(makeRpcData(softclipInterbase))
  expect(labels.filter(l => l.type === 'softclip').map(l => l.text)).toEqual([
    '(S5)',
  ])
})

// Zoomed out, this function used to walk every gap and every interbase entry to
// emit nothing — 1.5M array entries per frame across six open BAM tracks, ~80%
// of the main thread's JavaScript during a pan. It now skips a walk whose
// longest feature is too short to carry a label at the current zoom.
//
// That is a shortcut around `labelFadeOpacity`, so what these tests pin is that
// it is only ever a shortcut: the two must agree about every label, at every
// zoom, and in particular the cheap gate must not be the stricter of the pair.
// A gate that is slightly too eager is invisible in a screenshot and deletes
// labels at exactly the zooms they matter most.
describe('the zoom gate agrees with the per-feature fade', () => {
  const fontSize = computeLabelFontSize(10)

  // Its own runner, with the region sized to hold the feature: the sweep
  // compares against the unclamped span, and a deletion overhanging the region
  // is measured against its VISIBLE part instead (covered separately above).
  const inRegion = (rpcData: PileupDataResult, bpPerPx: number, end: number) =>
    computeVisibleLabels({
      view: {
        visibleRegions: [
          { displayedRegionIndex: 0, start: 0, end, screenStartPx: 0 },
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
      mismatchAlpha: false,
      scrollTop: 0,
    })

  const deletion = (len: number) =>
    makeRpcData({
      gapPositions: new Uint32Array([100, 100 + len]),
      gapYs: new Uint16Array([0]),
      gapLengths: new Uint32Array([len]),
      gapTypes: new Uint8Array([0]),
    })

  // 9 is the sharp case: the gate reserves the width of a ONE-digit length, so
  // on a one-digit deletion it is exactly the fade's own threshold rather than
  // a conservative under-estimate of it, and an off-by-one would show here
  // before anywhere else.
  test.each([9, 10, 100, 5000])('deletion of %i bp, swept across zoom', len => {
    const needed = measureText(String(len), fontSize)
    for (let bpPerPx = 0.05; bpPerPx < len; bpPerPx *= 1.15) {
      const expected =
        labelFadeOpacity(len / bpPerPx, needed) >= MIN_LABEL_OPACITY
      const labelled = inRegion(deletion(len), bpPerPx, len + 1000).some(
        l => l.type === 'deletion',
      )
      expect({ bpPerPx, labelled }).toEqual({ bpPerPx, labelled: expected })
    }
  })

  test.each([20, 300])('large insertion of %i bp, swept across zoom', len => {
    for (let bpPerPx = 0.05; bpPerPx < len; bpPerPx *= 1.15) {
      // An insertion is a point, so no clamping applies. Below
      // MIN_PX_PER_BP_FOR_TEXT the only insertion label available is the count
      // on a 'large' one, which fades against a fixed pixel threshold rather
      // than against its own text.
      const expected =
        labelFadeOpacity(len / bpPerPx, LONG_INSERTION_TEXT_THRESHOLD_PX) >=
        MIN_LABEL_OPACITY
      const labelled = inRegion(
        makeRpcData({
          interbasePositions: new Uint32Array([100]),
          interbaseYs: new Uint16Array([0]),
          interbaseLengths: new Uint32Array([len]),
          interbaseTypes: new Uint8Array([INTERBASE_INSERTION]),
        }),
        bpPerPx,
        len + 1000,
      ).some(l => l.type === 'insertion')
      expect({ bpPerPx, labelled }).toEqual({ bpPerPx, labelled: expected })
    }
  })

  // The gate is one answer for a whole array, so it has to be taken over the
  // longest feature in it. Taking it per feature, or over the first, drops
  // every other label in the array.
  test('one long deletion keeps the whole array walkable', () => {
    const labels = inRegion(
      makeRpcData({
        gapPositions: new Uint32Array([100, 140, 500, 5500]),
        gapYs: new Uint16Array([0, 1]),
        gapLengths: new Uint32Array([40, 5000]),
        gapTypes: new Uint8Array([0, 0]),
      }),
      1,
      7000,
    ).filter(l => l.type === 'deletion')
    expect(labels.map(l => l.text)).toEqual(['40', '5000'])
  })

  // A skip draws as a thin line with no length on it, so a long intron must not
  // be what keeps the deletion walk alive.
  test('a long skip does not resurrect the deletion walk', () => {
    expect(
      inRegion(
        makeRpcData({
          gapPositions: new Uint32Array([100, 102, 500, 50500]),
          gapYs: new Uint16Array([0, 1]),
          gapLengths: new Uint32Array([2, 50000]),
          gapTypes: new Uint8Array([0, 1]),
        }),
        50,
        60000,
      ),
    ).toHaveLength(0)
  })
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
    mismatchAlpha: false,
    scrollTop: 200,
  })
  expect(labels.filter(l => l.type === 'mismatch')).toHaveLength(3)
})
