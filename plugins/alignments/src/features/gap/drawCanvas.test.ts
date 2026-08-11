import { drawGaps } from './drawCanvas.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { GapUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function recordingCtx() {
  const rects: { x: number; w: number }[] = []
  const ctx = {
    set fillStyle(_v: string) {},
    get fillStyle() {
      return ''
    },
    fillRect(x: number, _y: number, w: number) {
      rects.push({ x, w })
    },
  } as unknown as Ctx2D
  return { ctx, rects }
}

function baseState(overrides: Partial<RenderState> = {}): RenderState {
  return {
    scrollTop: 0,
    featureHeight: 10,
    featureSpacing: 0,
    canvasHeight: 1000,
    filterMismatchesByFrequency: false,
    pileupTopOffset: 0,
    colors: {
      colorDeletion: [0.5, 0.5, 0.5],
      colorSkip: [0, 0, 1],
    } as RenderState['colors'],
    ...overrides,
  } as RenderState
}

const GAP_DELETION = 0
const GAP_SKIP = 1

function oneGap(start: number, end: number, type: number): GapUploadData {
  return {
    gapPositions: new Uint32Array([start, end]),
    gapYs: new Uint16Array([0]),
    gapTypes: new Uint8Array([type]),
    gapFrequencies: new Uint8Array([255]),
  }
}

// bp 1000..1100 across 100px => 1 px/bp. A 1bp gap is exactly 1px, a sub-bp one
// is not expressible — so widen the block instead to get a sub-pixel gap: at
// bpLength 400 over 100px the view is 4bp/px and a 1bp gap spans 0.25px.
const BLOCK: DrawBlock = { start: 1000, end: 1400, screenStartPx: 0 }
const BP_LENGTH = 400
const BLOCK_WIDTH = 100

function rectFor(gap: GapUploadData, block: DrawBlock = BLOCK) {
  const { ctx, rects } = recordingCtx()
  drawGaps(ctx, gap, block, BP_LENGTH, BLOCK_WIDTH, baseState())
  return rects[0]!
}

// gap.slang widens a sub-pixel gap through `expandMinWidthX`, which centers the
// 1px result on the span's midpoint. Canvas2D anchored the widened mark at the
// gap's LEFT edge, so every sub-pixel gap sat up to half a pixel right of the
// GPU's — the divergence the coverage marks were fixed for, on the call site
// that fix missed.
describe('sub-pixel gaps are widened about their midpoint', () => {
  // bp 1040 is 40bp from the block start => 10px in. A 1bp gap spans
  // [10, 10.25], whose midpoint is 10.125, so the 1px mark runs [9.625, 10.625].
  test('deletion', () => {
    const { x, w } = rectFor(oneGap(1040, 1041, GAP_DELETION))
    expect(w).toBe(1)
    expect(x).toBeCloseTo(9.625)
  })

  // The shader widens once, before it splits deletion from skip, so the skip
  // centerline gets the identical treatment.
  test('skip', () => {
    const { x, w } = rectFor(oneGap(1040, 1041, GAP_SKIP))
    expect(w).toBe(1)
    expect(x).toBeCloseTo(9.625)
  })

  // Reversed blocks run bp leftward, so bp 1040's span is [89.75, 90] and the
  // centered mark is the mirror of the forward case about the block.
  test('reversed block', () => {
    const { x, w } = rectFor(oneGap(1040, 1041, GAP_DELETION), {
      ...BLOCK,
      reversed: true,
    })
    expect(w).toBe(1)
    expect(x).toBeCloseTo(89.375)
  })
})

// Above 1px the clamp doesn't fire and the mark keeps its true left edge —
// centering must not shift a gap that was already wide enough.
test('a gap wider than a pixel keeps its own edges', () => {
  const { x, w } = rectFor(oneGap(1040, 1060, GAP_DELETION))
  expect(x).toBeCloseTo(10)
  expect(w).toBeCloseTo(5)
})
