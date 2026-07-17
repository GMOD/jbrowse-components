import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import { drawMultiRowBlocks } from './drawMultiRowBlocks.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './multiRowRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

interface FillRectCall {
  x: number
  y: number
  w: number
  h: number
  fillStyle: string
}

function mockCtx() {
  const calls: FillRectCall[] = []
  const ctx = {
    fillStyle: '',
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
  }
  return { ctx: ctx as unknown as Ctx2D, calls }
}

const RED = 0xff0000ff
const BLUE = 0xffff0000

// One region with two features on two rows; 1000px maps 100bp → 10px/bp.
const region: MultiRowRegionData = {
  featureStarts: Uint32Array.from([10, 50]),
  featureEnds: Uint32Array.from([20, 60]),
  featureColors: Uint32Array.from([RED, BLUE]),
  partitionValues: ['mom', 'dad'],
  featurePartitionIndex: Uint32Array.from([0, 1]),
  featureNames: ['a', 'b'],
  featureIds: ['f1', 'f2'],
  usedItemRgb: false,
}

const block: RenderBlock = {
  displayedRegionIndex: 0,
  // refName: 'ctgA',
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const state: MultiRowRenderState = {
  canvasWidth: 1000,
  canvasHeight: 40,
  rowHeight: 20,
  rowProportion: 1,
  rowIndexByValue: new Map([
    ['mom', 0],
    ['dad', 1],
  ]),
}

test('draws one rect per feature at its row + genomic span and color', () => {
  const { ctx, calls } = mockCtx()
  drawMultiRowBlocks(ctx, new Map([[0, region]]), [block], state)
  expect(calls).toEqual([
    { x: 100, y: 0, w: 100, h: 20, fillStyle: abgrToCssRgba(RED) },
    { x: 500, y: 20, w: 100, h: 20, fillStyle: abgrToCssRgba(BLUE) },
  ])
})

// A sub-1px feature is widened to the 1px minimum by extendToMinWidth, anchored
// on its start edge exactly as multiRow.slang does. On a reversed block the
// start edge is the mark's *right* edge, so the fill must grow leftward from it;
// growing rightward off the leftmost edge instead offsets every sub-pixel
// feature ~1px from where the GPU path paints it — the zoomed-out case on a
// flipped region, i.e. most of the features on screen.
test('sub-pixel features widen to 1px away from their anchored start edge', () => {
  // 100bp over 50px => 0.5px/bp, so this 1bp feature spans half a pixel.
  const narrow: MultiRowRegionData = {
    ...region,
    featureStarts: Uint32Array.from([50]),
    featureEnds: Uint32Array.from([51]),
    featureColors: Uint32Array.from([RED]),
    featurePartitionIndex: Uint32Array.from([0]),
    featureNames: ['a'],
    featureIds: ['f1'],
  }
  const narrowBlock = { ...block, screenEndPx: 50 }
  const draw = (reversed: boolean) => {
    const { ctx, calls } = mockCtx()
    drawMultiRowBlocks(
      ctx,
      new Map([[0, narrow]]),
      [{ ...narrowBlock, reversed }],
      state,
    )
    return calls[0]!
  }
  // Forward: bp 50 starts at x=25, mark grows right to [25,26].
  expect(draw(false)).toMatchObject({ x: 25, w: 1 })
  // Reversed: bp 50 still starts at x=25, but the mark grows *left* to [24,25].
  expect(draw(true)).toMatchObject({ x: 24, w: 1 })
})

test('skips features whose row is filtered out of rowIndexByValue', () => {
  const { ctx, calls } = mockCtx()
  drawMultiRowBlocks(ctx, new Map([[0, region]]), [block], {
    ...state,
    rowIndexByValue: new Map([['mom', 0]]),
  })
  expect(calls).toEqual([
    { x: 100, y: 0, w: 100, h: 20, fillStyle: abgrToCssRgba(RED) },
  ])
})

test('skips features whose color is a hidden category', () => {
  const { ctx, calls } = mockCtx()
  drawMultiRowBlocks(ctx, new Map([[0, region]]), [block], {
    ...state,
    hiddenColors: new Set([BLUE]),
  })
  expect(calls).toEqual([
    { x: 100, y: 0, w: 100, h: 20, fillStyle: abgrToCssRgba(RED) },
  ])
})

test('rowColorsByIndex overrides the baked feature color per row', () => {
  const GREEN = 0xff00ff00
  const { ctx, calls } = mockCtx()
  // override row 0 with green; row 1 keeps its baked BLUE
  drawMultiRowBlocks(ctx, new Map([[0, region]]), [block], {
    ...state,
    rowColorsByIndex: [GREEN, undefined],
  })
  expect(calls.map(c => c.fillStyle)).toEqual([
    abgrToCssRgba(GREEN),
    abgrToCssRgba(BLUE),
  ])
})
