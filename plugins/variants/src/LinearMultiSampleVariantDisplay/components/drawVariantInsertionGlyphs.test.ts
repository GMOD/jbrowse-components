import { insertionBarWidth } from '@jbrowse/alignments-core'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  anyMarkerPossibleForBlock,
  drawVariantInsertionGlyphs,
  markersForBlock,
} from './drawVariantInsertionGlyphs.ts'

import type { VariantInsertionGlyphData } from './drawVariantInsertionGlyphs.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
} from './variantRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface FillRectCall {
  x: number
  y: number
  w: number
  h: number
  fillStyle: string
}

function mockCtx() {
  const calls: FillRectCall[] = []
  const texts: { text: string; x: number; y: number }[] = []
  const strokes: { w: number; h: number }[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    rect() {},
    clip() {},
    strokeStyle: '',
    lineWidth: 0,
    strokeRect(_x: number, _y: number, w: number, h: number) {
      strokes.push({ w, h })
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y })
    },
  }
  return { ctx: ctx as unknown as Ctx2D, calls, texts, strokes }
}

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
// screen row 0 carries the allele, screen row 1 is reference.
//
// Laid out the way computeVariantCells emits it — the reference bucket first,
// then the non-reference one, with `refCellCount` marking the boundary — so the
// pass under test sees the ordering it (and the hit test) rely on rather than an
// arrangement no payload can actually have.
const INSERTED = 65481
// packed ABGR: the reference grey, a hom-alt blue and a paler het-alt blue
const REF_ABGR = 0xffcccccc
const HOM_ABGR = 0xff8c5926
const HET_ABGR = 0xffc6a273
function data(
  overrides?: Partial<VariantInsertionGlyphData>,
): VariantInsertionGlyphData {
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

const HOM_COLOR = abgrToCssRgba(HOM_ABGR)
const HET_COLOR = abgrToCssRgba(HET_ABGR)

function draw(
  region: VariantInsertionGlyphData,
  overrides?: Partial<VariantRenderState>,
) {
  const { ctx, calls, texts, strokes } = mockCtx()
  drawVariantInsertionGlyphs(ctx, new Map([[0, region]]), [block], {
    ...state,
    ...overrides,
  })
  return { calls, texts, strokes }
}

const BAR = insertionBarWidth(INSERTED, 10, 20)

// The defect this pass exists for: without it the 65 kb insertion draws at the
// same 2px floor a SNP does.
test('widens the alt-carrying cell to a bar sized by the inserted bp', () => {
  const { calls } = draw(data())
  expect(calls).toEqual([
    {
      x: 105 - BAR / 2,
      y: 0,
      w: BAR,
      h: 20,
      fillStyle: HOM_COLOR,
    },
  ])
})

// Widening a reference cell would claim that haplotype carries the sequence, so
// only row 0 above is drawn. Same for a no-call.
test('leaves reference and no-call cells alone', () => {
  const { calls } = draw(data({ cellAltDosage: Uint8Array.from([0, 0]) }))
  expect(calls).toEqual([])
})

// Hue keeps one meaning: the marker is the cell, widened. It used to take the
// theme's insertion purple, so a variant read as an insertion only at the zooms
// where the marker outgrew its cell.
test("markers take the cell's own color", () => {
  const { calls } = draw(data())
  expect(calls.map(c => c.fillStyle)).toEqual([HOM_COLOR])
})

// Each marker sets its fill from its own cell, so a labelled marker (whose
// label changes the fill mid-loop) leaves nothing behind for the next one.
test('a labelled marker does not leave its label color behind', () => {
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
  expect(texts).toHaveLength(2)
  expect(calls.map(c => c.fillStyle)).toEqual([HOM_COLOR, HET_COLOR])
})

test('draws nothing for a SNP or a deletion', () => {
  // a record that inserts nothing: its own reference span already draws it at the
  // right width, which is why deletions need no glyph at all
  expect(draw(data({ featureInsertedBp: Int32Array.from([0]) })).calls).toEqual(
    [],
  )
})

test('labels the marker with the bp count when the row is tall enough', () => {
  expect(draw(data()).texts).toEqual([
    { text: String(INSERTED), x: 105, y: 10 },
  ])
})

// The real 464-haplotype case: a 200 kb window over 1000px and ~2px rows. The
// row is too short for the count, so the bar falls to the capped 5px form — but
// the cell it replaces is a 1bp insertion at 0.005 px/bp, i.e. the 2px floor, so
// the widening is still the difference between "visible as a SNP" and "visible as
// an SV".
test('widens without a label on rows too short for letters', () => {
  const wideBlock: VariantRenderBlock = { ...block, end: 200000 }
  const { ctx, calls, texts } = mockCtx()
  drawVariantInsertionGlyphs(ctx, new Map([[0, data()]]), [wideBlock], {
    ...state,
    rowHeight: 2,
  })
  expect(calls).toHaveLength(1)
  expect(calls[0]!.w).toBeGreaterThan(2)
  expect(calls[0]!.w).toBe(insertionBarWidth(INSERTED, 1000 / 200000, 2))
  expect(texts).toEqual([])
})

// Inset half a pixel a side, a stroke on a 2-3px row covers the whole marker,
// which then reads as the outline's near-black rather than its genotype.
test('outlines a marker only where an interior survives the stroke', () => {
  expect(draw(data()).strokes).toEqual([{ w: BAR - 1, h: 19 }])
  expect(draw(data(), { rowHeight: 3 }).strokes).toEqual([])
})

test('skips a cell already wider than the bar', () => {
  // a record covering 20bp (200px) of reference is wider than any bar this
  // insertion earns, so a second fill would be pure overdraw
  const { calls } = draw(data({ featurePositions: Uint32Array.from([10, 30]) }))
  expect(calls).toEqual([])
})

test('culls cells scrolled out of view', () => {
  expect(draw(data(), { scrollTop: 500 }).calls).toEqual([])
})

// The legend asks whether a marker draws at ANY sub-pixel pan position, so that
// a swatch does not blink mid-drag and a single-frame export is right without
// settling. This is the shape where the painter's own answer does flip: a long
// REF whose span lands between two integer cell widths, with a longer ALT.
describe('anyMarkerPossibleForBlock is pan-stable where the painter is not', () => {
  // 100 bp/px, so a 3350bp reference span is 33.5px -- the cell snaps to 33 or
  // 34 depending where the grid lands, and the marker is 34.
  const panBlock = (phase: number): VariantRenderBlock => ({
    displayedRegionIndex: 0,
    start: 0,
    end: 100000,
    screenStartPx: phase,
    screenEndPx: 1000 + phase,
    reversed: false,
  })
  const region = data({
    featurePositions: Uint32Array.from([0, 3350]),
    featureInsertedBp: Int32Array.from([7833]),
  })
  const phases = Array.from({ length: 24 }, (_, i) => i * 0.5)

  test('the painter flips across sub-pixel pan', () => {
    const painter = phases.map(
      p => markersForBlock(region, panBlock(p), 20, 1000).anyMarker,
    )
    expect(new Set(painter).size).toBe(2)
  })

  test('the legend does not', () => {
    const legend = phases.map(p =>
      anyMarkerPossibleForBlock(region, panBlock(p), 20),
    )
    expect(new Set(legend)).toEqual(new Set([true]))
  })
})
