import { bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import * as insertionShader from '../../shaders/slang/insertion.generated.ts'
import { drawInsertions } from './drawCanvas.ts'
import { hitTestLargeInsertion, hitTestSmallInsertion } from './hitTest.ts'
import { packInsertions } from './packGpu.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Draw against hit test, and pack against draw, for the first `point` mark.
//
// A point's hit target is deliberately WIDER than its ink — a 1px bar is not
// something a person can click — so the claim a span mark makes ("every hit
// lands inside the rect the painter drew") is not available here. What replaces
// it is the same claim plus the slop the mark declares: **everything hittable is
// drawn, within `INSERTION_HIT_SLOP_PX` of its own bar**. The converse stays
// false on purpose, for the reason gap's gate states.
//
// The fixture also holds clips, because the sub-range bound is new: the merged
// interbase array is laid out (insertions, softclips, hardclips) and the mark
// owns only the prefix. An insertion pass that forgot that would draw a clip as
// an insertion, pack it, and answer a hover with it.

const BLOCK_START = 1000
const BP_LENGTH = 400
const BLOCK_WIDTH = 100
const BP_PER_PX = BP_LENGTH / BLOCK_WIDTH
const FEATURE_HEIGHT = 10
// Pixels of slop the mark adds either side of the drawn bar.
const HIT_SLOP_PX = 2
// The projection and its inverse are two float expressions of one line, so an
// edge sample lands an ulp either side of it.
const EPS = 1e-9

// Three insertions and then two clips, each on its own row so every mark owns
// its own scan. The insertions are: a small one (1px bar), a large one (a
// count-label box 28px wide), and a small one the worker zeroed — drawn at the
// fade's floor and deliberately inert.
const NUM_INSERTIONS = 3
const DATA = {
  interbasePositions: new Uint32Array([1040, 1150, 1260, 1300, 1340]),
  interbaseYs: new Uint16Array([0, 1, 2, 3, 4]),
  interbaseLengths: new Uint32Array([3, 100, 3, 7, 7]),
  interbaseFrequencies: new Uint8Array([255, 255, 0, 255, 255]),
  interbaseSequences: ['ACG', '', 'TTT', '', ''],
  numInsertions: NUM_INSERTIONS,
  numSoftclips: 1,
  numHardclips: 1,
} as unknown as PileupDataResult

function state(): RenderState {
  return {
    scrollTop: 0,
    featureHeight: FEATURE_HEIGHT,
    featureSpacing: 0,
    canvasHeight: 1000,
    filterMismatchesByFrequency: true,
    pileupTopOffset: 0,
    colors: { colorInsertion: [0.75, 0, 0.75] } as RenderState['colors'],
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

function bounds(reversed: boolean) {
  return {
    start: BLOCK_START,
    end: BLOCK_START + BP_LENGTH,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
}

function resolvedBlock(reversed: boolean): ResolvedBlock {
  return {
    rpcData: DATA,
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

// The serif caps draw as paths, and only above INSERTION_SERIF_MIN_PX_PER_BP —
// well inside base-level zoom, so nothing here reaches them. The path methods
// are still accepted, since a recorder that throws would turn a decoration bug
// into an unrelated failure.
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
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
  } as unknown as Ctx2D
  return { ctx, rects }
}

function painted(reversed: boolean, data: InterbaseUploadData = DATA) {
  const { ctx, rects } = recordingCtx()
  drawInsertions(ctx, data, block(reversed), BP_LENGTH, BLOCK_WIDTH, state())
  return rects
}

// One instance's payload, so the rect the painter drew for it is unambiguous —
// the painter holds no state across instances, so drawing one alone is what it
// would have drawn in the crowd.
function oneInsertion(index: number): InterbaseUploadData {
  return {
    interbasePositions: DATA.interbasePositions.slice(index, index + 1),
    interbaseYs: DATA.interbaseYs.slice(index, index + 1),
    interbaseLengths: DATA.interbaseLengths.slice(index, index + 1),
    interbaseFrequencies: DATA.interbaseFrequencies.slice(index, index + 1),
    numInsertions: 1,
    numSoftclips: 0,
    numHardclips: 0,
  }
}

function drawnRect(index: number, reversed: boolean) {
  return painted(reversed, oneInsertion(index))[0]
}

function coordsAt(
  canvasX: number,
  row: number,
  reversed: boolean,
): CigarCoords {
  const genomicPos = bpAtPxExact(canvasX, bounds(reversed))
  return {
    bpPerPx: BP_PER_PX,
    genomicPos,
    basePos: Math.floor(genomicPos),
    row,
    adjustedY: row * FEATURE_HEIGHT,
    yWithinRow: 1,
  }
}

// The pipeline's two slots, in `hitTestCigarItem`'s order: a large insertion's
// box outranks a mismatch, a small one's bar loses to it, and between them they
// answer for every insertion exactly once.
function hitAt(
  canvasX: number,
  row: number,
  reversed: boolean,
  filterByFrequency = true,
) {
  const resolved = resolvedBlock(reversed)
  const coords = coordsAt(canvasX, row, reversed)
  return (
    hitTestLargeInsertion(resolved, coords, FEATURE_HEIGHT) ??
    hitTestSmallInsertion(resolved, coords, FEATURE_HEIGHT, filterByFrequency)
  )
}

function packed() {
  const u32 = new Uint32Array(packInsertions(DATA))
  const s32 = insertionShader.INSTANCE_STRIDE_WORDS
  const F = insertionShader.INSTANCE_OFFSET_U32
  const out: { position: number; y: number; length: number }[] = []
  for (let o = 0; o < u32.length; o += s32) {
    out.push({
      position: u32[o + F.position]!,
      y: u32[o + F.y]!,
      length: u32[o + F.length]!,
    })
  }
  return out
}

describe.each([false, true])('reversed: %s', reversed => {
  test('every hit is drawn, within the slop of its own bar', () => {
    let hits = 0
    for (let row = 0; row < DATA.interbaseYs.length; row++) {
      for (let x = 0; x <= BLOCK_WIDTH; x += 0.25) {
        const hit = hitAt(x, row, reversed)
        if (hit) {
          hits++
          // The sub-range bound, swept: a clip shares this array and this row
          // space, and the insertion pass owns neither.
          expect(hit.index).toBeLessThan(NUM_INSERTIONS)
          const rect = drawnRect(hit.index, reversed)
          expect(rect).toBeDefined()
          expect(x + HIT_SLOP_PX + EPS).toBeGreaterThanOrEqual(rect!.x)
          expect(x - HIT_SLOP_PX - EPS).toBeLessThanOrEqual(rect!.x + rect!.w)
          expect(rect!.y).toBeGreaterThanOrEqual(row * FEATURE_HEIGHT)
          expect(rect!.y + rect!.h).toBeLessThanOrEqual(
            (row + 1) * FEATURE_HEIGHT,
          )
        }
      }
    }
    expect(hits).toBeGreaterThan(0)
  })

  // The converse, where it does hold: a marker significant enough to click
  // answers at the middle of its own drawn bar, whichever slot it falls in.
  test.each([
    ['small insertion', 0],
    ['large insertion', 1],
  ])('a drawn %s is hittable at the center of its bar', (_name, index) => {
    const rect = drawnRect(index, reversed)!
    const hit = hitAt(rect.x + rect.w / 2, DATA.interbaseYs[index]!, reversed)
    expect(hit?.index).toBe(index)
  })

  // Pack against draw: the bp the vertex buffer carries is the bp the painter
  // centred its bar on, mapped back through `bpAtPxExact` — the projection's own
  // inverse, and the one a point uses because it has no cell to floor into.
  test('each instance names the bp the painter centred its bar on', () => {
    const rects = painted(reversed)
    const instances = packed()
    expect(instances).toHaveLength(NUM_INSERTIONS)
    expect(rects).toHaveLength(NUM_INSERTIONS)
    for (const [i, instance] of instances.entries()) {
      const rect = rects[i]!
      expect(bpAtPxExact(rect.x + rect.w / 2, bounds(reversed))).toBeCloseTo(
        instance.position,
        9,
      )
      expect(instance.y).toBe(DATA.interbaseYs[i]!)
      expect(instance.length).toBe(DATA.interbaseLengths[i]!)
    }
  })
})

// The divergence that is not drift. Index 2 is an insertion the worker zeroed:
// insertion.slang goes on painting it at the frequency fade's floor, and it must
// still answer nothing, or the read that draws solid across it is unselectable
// there.
test('an insertion below the frequency threshold is drawn and not hittable', () => {
  const rect = drawnRect(2, false)!
  expect(rect).toBeDefined()
  expect(hitAt(rect.x + rect.w / 2, 2, false)).toBeUndefined()
})

test('with frequency filtering off it answers again', () => {
  const rect = drawnRect(2, false)!
  expect(hitAt(rect.x + rect.w / 2, 2, false, false)?.index).toBe(2)
})
