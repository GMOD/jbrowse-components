import {
  insertionBarWidth,
  paintInsertionLabels,
} from '@jbrowse/alignments-core'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'

import {
  anyMarkerPossibleForBlock,
  variantInsertionChannels,
} from './variantInsertions.ts'
import { VARIANT_MARKS, variantInsertionParams } from './variantMarks.ts'

import type { VariantInsertionData } from './variantInsertions.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'

// 100bp over 1000px => 10px/bp.
const block: VariantRenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const state: VariantRenderState = {
  canvasWidth: 1000,
  canvasHeight: 100,
  rowHeight: 20,
  scrollTop: 0,
}

// One insertion record (1bp of reference, the VCF convention) with two cells:
// screen row 0 carries the allele, screen row 1 is reference. Laid out the way
// computeVariantCells emits it — the reference bucket first, then the
// non-reference one, with `refCellCount` marking the boundary.
const INSERTED = 65481
// packed ABGR: the reference grey, a hom-alt blue and a paler het-alt blue
const REF_ABGR = 0xffcccccc
const HOM_ABGR = 0xff8c5926
const HET_ABGR = 0xffc6a273
function data(overrides?: Partial<VariantInsertionData>): VariantInsertionData {
  return {
    cellRowIndices: Uint32Array.from([1, 0]),
    cellColors: Uint32Array.from([REF_ABGR, HOM_ABGR]),
    cellAltDosage: Uint8Array.from([0, 255]),
    cellFeatureIndices: Uint32Array.from([0, 0]),
    featurePositions: Uint32Array.from([10, 11]),
    featureInsertedBp: Int32Array.from([INSERTED]),
    numCells: 2,
    refCellCount: 1,
    ...overrides,
  }
}

const MARK = VARIANT_MARKS[1]!

function payload(region: VariantInsertionData): VariantUploadData {
  return {
    cellPositions: new Uint32Array(0),
    cellRowIndices: new Uint32Array(0),
    cellColors: new Uint32Array(0),
    cellShapeTypes: new Uint8Array(0),
    numCells: 0,
    insertions: variantInsertionChannels(region),
  }
}

function draw(
  region: VariantInsertionData,
  overrides?: Partial<VariantRenderState>,
  b = block,
) {
  const s = { ...state, ...overrides }
  const { ctx, calls } = recordingContext()
  const strokes: { w: number; h: number }[] = []
  ctx.strokeRect = (_x, _y, w, h) => {
    strokes.push({ w, h })
  }
  MARK.paintBlock(ctx, payload(region), b, s)
  const texts: { text: string; x: number; y: number; fill: string }[] = []
  const labelCtx = {
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y, fill: String(this.fillStyle) })
    },
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
  }
  paintInsertionLabels(
    labelCtx,
    [b],
    () => payload(region).insertions,
    s,
    variantInsertionParams(s),
  )
  return {
    calls: calls.map(({ x, y, w, h, fillStyle }) => ({
      x,
      y,
      w,
      h,
      fillStyle,
    })),
    texts,
    strokes,
  }
}

const BAR = insertionBarWidth(INSERTED, 10, 20)
const HOM_COLOR = abgrToCssRgba(HOM_ABGR)
const HET_COLOR = abgrToCssRgba(HET_ABGR)

// The defect the marker exists for: without it the 65 kb insertion draws at the
// same 2px floor a SNP does.
test('widens the alt-carrying cell to a bar sized by the inserted bp', () => {
  expect(draw(data()).calls).toEqual([
    { x: 105 - BAR / 2, y: 0, w: BAR, h: 20, fillStyle: HOM_COLOR },
  ])
})

// Widening a reference cell would claim that haplotype carries the sequence.
test('reference and no-call cells carry no marker', () => {
  expect(
    variantInsertionChannels(data({ cellAltDosage: Uint8Array.from([0, 0]) }))
      .count,
  ).toBe(0)
})

test("each marker takes its cell's own color", () => {
  const { calls, texts } = draw(
    data({
      cellRowIndices: Uint32Array.from([2, 0, 1]),
      cellColors: Uint32Array.from([REF_ABGR, HOM_ABGR, HET_ABGR]),
      cellAltDosage: Uint8Array.from([0, 255, 128]),
      cellFeatureIndices: Uint32Array.from([0, 0, 0]),
      numCells: 3,
      refCellCount: 1,
    }),
  )
  expect(calls.map(c => c.fillStyle)).toEqual([HOM_COLOR, HET_COLOR])
  expect(texts).toHaveLength(2)
})

test('a SNP or a deletion carries no marker', () => {
  expect(
    variantInsertionChannels(data({ featureInsertedBp: Int32Array.from([0]) }))
      .count,
  ).toBe(0)
})

// The count sits in the bar, so it takes whichever text color clears the
// bar: core's `getContrastText`, the rule every other display's labels use.
test('labels the marker with the bp count in the color that clears it', () => {
  expect(draw(data()).texts).toEqual([
    { text: String(INSERTED), x: 105, y: 10, fill: '#fff' },
  ])
  const pale = data({ cellColors: Uint32Array.from([REF_ABGR, 0xffeeeeee]) })
  expect(draw(pale).texts.map(t => t.fill)).toEqual(['rgba(0, 0, 0, 0.87)'])
})

// The real 464-haplotype case: a 200 kb window over 1000px and ~2px rows. The
// row is too short for the count, so the bar falls to the capped 5px form.
test('widens without a label on rows too short for letters', () => {
  const wideBlock: VariantRenderBlock = { ...block, end: 200000 }
  const { calls, texts } = draw(data(), { rowHeight: 2 }, wideBlock)
  expect(calls).toHaveLength(1)
  expect(calls[0]!.w).toBe(insertionBarWidth(INSERTED, 1000 / 200000, 2))
  expect(calls[0]!.w).toBeGreaterThan(2)
  expect(texts).toEqual([])
})

// Inset half a pixel a side, a stroke on a 2-3px row covers the whole marker,
// which then reads as the outline's near-black rather than its genotype.
test('outlines a marker only where an interior survives the stroke', () => {
  expect(draw(data()).strokes).toEqual([{ w: BAR - 1, h: 19 }])
  expect(draw(data(), { rowHeight: 3 }).strokes).toEqual([])
})

test('skips a cell already wider than the bar', () => {
  const { calls, texts } = draw(
    data({ featurePositions: Uint32Array.from([10, 30]) }),
  )
  expect(calls).toEqual([])
  expect(texts).toEqual([])
})

test('culls cells scrolled out of view', () => {
  expect(draw(data(), { scrollTop: 500 }).calls).toEqual([])
})

// A long REF whose span lands between two integer cell widths, with a longer
// ALT: the cell snaps to 33 or 34px with the pan phase, and the marker is 34.
// The marker's gate reads the unsnapped span, so the painter and the legend
// give one answer at every phase and a swatch never blinks mid-drag.
test('the painter and the legend agree at every sub-pixel pan', () => {
  const region = data({
    featurePositions: Uint32Array.from([0, 3350]),
    featureInsertedBp: Int32Array.from([7833]),
  })
  for (let i = 0; i < 24; i++) {
    const phase = i * 0.5
    const panBlock: VariantRenderBlock = {
      displayedRegionIndex: 0,
      start: 0,
      end: 100000,
      screenStartPx: phase,
      screenEndPx: 1000 + phase,
      reversed: false,
    }
    expect(draw(region, {}, panBlock).calls).toHaveLength(1)
    expect(anyMarkerPossibleForBlock(region, panBlock, 20)).toBe(true)
  }
})
