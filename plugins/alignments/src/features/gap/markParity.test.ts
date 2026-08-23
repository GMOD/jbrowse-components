import { bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'
import { drawDeletions, drawSkips } from './drawCanvas.ts'
import { hitTestGap } from './hitTest.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { GapUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Draw against hit test, which is the gate this repo did not have: every parity
// mechanism in GPU_RENDERING.md and CROSS_BACKEND_GATE.md compares the GPU with
// Canvas2D, and the third copy of a feature — the hit test — drifted against
// both under comments rather than under a check. Both marks now come off one
// declaration (`gapMark`), so this pins the property that made that worth doing.
//
// The claim is one-directional on purpose: **everything hittable is drawn**. The
// converse is false by design, and deliberately so — a mark below the worker's
// frequency threshold still paints at the fade's floor while being inert, so it
// cannot steal a click from the read body under it (`passesFrequencyGate`). The
// direction pinned here is the one whose failure is a bug: an invisible mark
// intercepting clicks across its span.

const BLOCK_START = 1000
const BP_LENGTH = 400
const BLOCK_WIDTH = 100
const BP_PER_PX = BP_LENGTH / BLOCK_WIDTH
const FEATURE_HEIGHT = 10
// The projection and its inverse are two float expressions of one line, so an
// edge sample lands an ulp either side of it.
const EPS = 1e-9

// A deletion under a pixel wide (bp 1040..1041 is 0.25px at 4bp/px), an intron,
// one several pixels wide, and a sub-pixel deletion the worker zeroed — the mark
// that is drawn and must not be hittable. The zeroed one has to be sub-pixel to
// exercise the gate at all: `bpPerPx / length <= 1` is "already covers a pixel",
// and a wide deletion passes on its span whatever its frequency. Rows are distinct so each mark owns its own
// scan, and the two kinds are interleaved because they share one array.
const GAPS: GapUploadData = {
  gapPositions: new Uint32Array([
    1040, 1041, 1100, 1200, 1220, 1260, 1300, 1301,
  ]),
  gapYs: new Uint16Array([0, 1, 2, 3]),
  gapTypes: new Uint8Array([
    GAP_DELETION,
    GAP_SKIP,
    GAP_DELETION,
    GAP_DELETION,
  ]),
  gapFrequencies: new Uint8Array([255, 0, 255, 0]),
}

function state(): RenderState {
  return {
    scrollTop: 0,
    featureHeight: FEATURE_HEIGHT,
    featureSpacing: 0,
    canvasHeight: 1000,
    filterMismatchesByFrequency: true,
    pileupTopOffset: 0,
    colors: {
      colorDeletion: [0.5, 0.5, 0.5],
      colorSkip: [0, 0, 1],
    } as RenderState['colors'],
  } as RenderState
}

function block(reversed: boolean): DrawBlock {
  return {
    start: BLOCK_START,
    end: BLOCK_START + BP_LENGTH,
    screenStartPx: 0,
    reversed,
  }
}

function resolvedBlock(reversed: boolean): ResolvedBlock {
  return {
    // The gap arrays are the only ones either consumer reads, as the fixtures in
    // hitTestPipeline.test.ts state a partial payload the same way.
    rpcData: GAPS as PileupDataResult,
    bpRange: [BLOCK_START, BLOCK_START + BP_LENGTH],
    blockStartPx: 0,
    blockWidth: BLOCK_WIDTH,
    refName: 'ctgA',
    reversed,
  }
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function recordingCtx() {
  const rects: Rect[] = []
  const ctx = {
    set fillStyle(_v: string) {},
    get fillStyle() {
      return ''
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h })
    },
  } as unknown as Ctx2D
  return { ctx, rects }
}

// One instance's payload, so the rect the painter drew for it is unambiguous —
// the painter holds no state across instances, so drawing one alone is what it
// would have drawn in the crowd.
function oneGap(index: number): GapUploadData {
  return {
    gapPositions: GAPS.gapPositions.slice(index * 2, index * 2 + 2),
    gapYs: GAPS.gapYs.slice(index, index + 1),
    gapTypes: GAPS.gapTypes.slice(index, index + 1),
    gapFrequencies: GAPS.gapFrequencies.slice(index, index + 1),
  }
}

function drawnRect(index: number, reversed: boolean) {
  const { ctx, rects } = recordingCtx()
  const draw = GAPS.gapTypes[index] === GAP_SKIP ? drawSkips : drawDeletions
  draw(ctx, oneGap(index), block(reversed), BP_LENGTH, BLOCK_WIDTH, state())
  return rects[0]
}

function coordsAt(
  canvasX: number,
  row: number,
  reversed: boolean,
): CigarCoords {
  const bounds = {
    start: BLOCK_START,
    end: BLOCK_START + BP_LENGTH,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
  return {
    bpPerPx: BP_PER_PX,
    genomicPos: bpAtPxExact(canvasX, bounds),
    basePos: Math.floor(bpAtPxExact(canvasX, bounds)),
    row,
    adjustedY: row * FEATURE_HEIGHT,
    yWithinRow: 1,
  }
}

describe.each([false, true])('reversed: %s', reversed => {
  test('every hit lands inside the rect the painter drew', () => {
    let hits = 0
    for (let row = 0; row < GAPS.gapYs.length; row++) {
      for (let x = 0; x <= BLOCK_WIDTH; x += 0.25) {
        const hit = hitTestGap(
          resolvedBlock(reversed),
          coordsAt(x, row, reversed),
          true,
          true,
        )
        if (hit) {
          hits++
          const rect = drawnRect(hit.index, reversed)
          expect(rect).toBeDefined()
          expect(x + EPS).toBeGreaterThanOrEqual(rect!.x)
          expect(x - EPS).toBeLessThanOrEqual(rect!.x + rect!.w)
          // The band is the mark's own — a full-height bar for a deletion, a 1px
          // centerline for an intron — and both have to lie inside the row the
          // hit test answered for. A centerline is hittable across the whole row
          // height on purpose: a 1px target is not one.
          expect(rect!.y).toBeGreaterThanOrEqual(row * FEATURE_HEIGHT)
          expect(rect!.y + rect!.h).toBeLessThanOrEqual(
            (row + 1) * FEATURE_HEIGHT,
          )
        }
      }
    }
    expect(hits).toBeGreaterThan(0)
  })

  // The converse, where it does hold: a mark wide enough to resolve and
  // significant enough to click answers at the middle of its own drawn bar.
  test.each([
    ['wide deletion', 2],
    ['intron centerline', 1],
  ])('a drawn %s is hittable at the center of its bar', (_name, index) => {
    const rect = drawnRect(index, reversed)!
    const hit = hitTestGap(
      resolvedBlock(reversed),
      coordsAt(rect.x + rect.w / 2, GAPS.gapYs[index]!, reversed),
      true,
      true,
    )
    expect(hit?.index).toBe(index)
  })
})

// The divergence that is not drift. Index 3 is a deletion the worker zeroed:
// gap.slang goes on painting it at the frequency fade's floor, and it must still
// answer nothing, or a read that draws solid across it is unselectable there.
test('a deletion below the frequency threshold is drawn and not hittable', () => {
  expect(drawnRect(3, false)).toBeDefined()
  expect(
    hitTestGap(resolvedBlock(false), coordsAt(75.1, 3, false), true, true),
  ).toBeUndefined()
})

// The same deletion with the toggle off: nothing is thresholded, so it is back.
test('with frequency filtering off it answers again', () => {
  expect(
    hitTestGap(resolvedBlock(false), coordsAt(75.1, 3, false), true, false)
      ?.index,
  ).toBe(3)
})

// `showMismatches` off takes the deletion layer with it, and the hit test has to
// go with the paint: both come off `gapMark({ deletions, skips: true })`.
test('an undrawn deletion layer answers nothing while introns still do', () => {
  const { ctx, rects } = recordingCtx()
  drawSkips(ctx, GAPS, block(false), BP_LENGTH, BLOCK_WIDTH, state())
  expect(rects).toHaveLength(1)
  expect(
    hitTestGap(resolvedBlock(false), coordsAt(50, 2, false), false, true),
  ).toBeUndefined()
  expect(
    hitTestGap(resolvedBlock(false), coordsAt(30, 1, false), false, true)?.type,
  ).toBe('skip')
})
