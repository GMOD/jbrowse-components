import { insertionBarWidth } from '@jbrowse/alignments-core'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import { drawVariantInsertionGlyphs } from './drawVariantInsertionGlyphs.ts'

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
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y })
    },
  }
  return { ctx: ctx as unknown as Ctx2D, calls, texts }
}

const ALT_BLUE = 0xffff0000
const REF_GREY = 0xffcccccc

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
function data(
  overrides?: Partial<VariantInsertionGlyphData>,
): VariantInsertionGlyphData {
  return {
    cellRowIndices: Uint32Array.from([1, 0]),
    cellColors: Uint32Array.from([REF_GREY, ALT_BLUE]),
    cellCarriesAlt: Uint8Array.from([0, 1]),
    cellFeatureIndices: Uint32Array.from([0, 0]),
    featurePositions: Uint32Array.from([10, 11]),
    featureInsertedBp: Int32Array.from([INSERTED]),
    numCells: 2,
    refCellCount: 1,
    ...overrides,
  }
}

function draw(
  region: VariantInsertionGlyphData,
  overrides?: Partial<VariantRenderState>,
) {
  const { ctx, calls, texts } = mockCtx()
  drawVariantInsertionGlyphs(ctx, new Map([[0, region]]), [block], {
    ...state,
    ...overrides,
  })
  return { calls, texts }
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
      fillStyle: abgrToCssRgba(ALT_BLUE),
    },
  ])
})

// Widening a reference cell would claim that haplotype carries the sequence, so
// only row 0 above is drawn. Same for a no-call.
test('leaves reference and no-call cells alone', () => {
  const { calls } = draw(data({ cellCarriesAlt: Uint8Array.from([0, 0]) }))
  expect(calls).toEqual([])
})

test('the marker keeps the cell genotype color, not the alignments purple', () => {
  // the color is what says which allele the haplotype carries; the marker only
  // supplies length, so it must not repaint over that
  const RED = 0xff0000ff
  const { calls } = draw(
    data({ cellColors: Uint32Array.from([REF_GREY, RED]) }),
  )
  expect(calls[0]!.fillStyle).toBe(abgrToCssRgba(RED))
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

test('skips a cell already wider than the bar', () => {
  // a record covering 20bp (200px) of reference is wider than any bar this
  // insertion earns, so a second fill would be pure overdraw
  const { calls } = draw(data({ featurePositions: Uint32Array.from([10, 30]) }))
  expect(calls).toEqual([])
})

test('culls cells scrolled out of view', () => {
  expect(draw(data(), { scrollTop: 500 }).calls).toEqual([])
})
