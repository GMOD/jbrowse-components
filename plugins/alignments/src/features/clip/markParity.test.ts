import { bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import * as clipShader from '../../shaders/slang/clip.generated.ts'
import { drawHardclips, drawSoftclips } from './drawCanvas.ts'
import { hitTestClip } from './hitTest.ts'
import { packClips } from './packGpu.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Draw against hit test for the second `point` mark, and the same shape as
// insertion's: **everything hittable is drawn, within the tolerance the mark
// declares**. A clip's tolerance is not a width derivation — a 1px bar plus the
// point slop would be 2.5px and this is 3px with a 0.5bp floor under it — which
// is why `clipMark` writes it down rather than deriving it, and why this file's
// constant is that member's and not insertion's.
//
// Two rules also meet here and only one loop could express either, so both are
// swept: softclip beats hardclip at the same row and position (the merged
// array's own layout), and within a kind the topmost bar wins.

const BLOCK_START = 1000
const BP_LENGTH = 400
const BLOCK_WIDTH = 100
const BP_PER_PX = BP_LENGTH / BLOCK_WIDTH
const FEATURE_HEIGHT = 10
// The mark's tolerance in px at this zoom, which is the bp floor's other side:
// `max(0.5 bp, 3 px)` is 3px wherever bpPerPx >= 1/6, and 4 is well past that.
const HIT_TOLERANCE_PX = 3
const EPS = 1e-9

// One insertion, then three softclips, then two hardclips — half-open bounds, so
// the softclips are [1, 4) and the hardclips [4, 6). Index 3 (a softclip) and
// index 5 (a hardclip) share a row AND a position, which is the pair the kind
// priority is about; index 2 is a softclip the worker zeroed. The leading
// insertion is what the clip marks' sub-range has to exclude — it shares the
// array, and at row 0 it shares the scan.
const INS_END = 1
const SC_END = 4
const HC_END = 6
const DATA = {
  interbasePositions: new Uint32Array([1040, 1120, 1200, 1280, 1320, 1280]),
  interbaseYs: new Uint16Array([0, 1, 2, 3, 4, 3]),
  interbaseLengths: new Uint32Array([3, 20, 15, 12, 8, 9]),
  interbaseFrequencies: new Uint8Array([255, 255, 0, 255, 255, 255]),
  numInsertions: INS_END,
  numSoftclips: SC_END - INS_END,
  numHardclips: HC_END - SC_END,
} as unknown as PileupDataResult

function state(): RenderState {
  return {
    scrollTop: 0,
    featureHeight: FEATURE_HEIGHT,
    featureSpacing: 0,
    canvasHeight: 1000,
    filterMismatchesByFrequency: true,
    pileupTopOffset: 0,
    colors: {
      colorSoftclip: [1, 0, 0],
      colorHardclip: [0, 0, 1],
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

function painted(reversed: boolean, data: InterbaseUploadData = DATA) {
  const { ctx, rects } = recordingCtx()
  drawSoftclips(ctx, data, block(reversed), BP_LENGTH, BLOCK_WIDTH, state())
  const softCount = rects.length
  drawHardclips(ctx, data, block(reversed), BP_LENGTH, BLOCK_WIDTH, state())
  return { rects, softCount }
}

// One instance's payload, in the slice its own kind occupies.
function oneClip(index: number): InterbaseUploadData {
  const soft = index < SC_END
  return {
    interbasePositions: DATA.interbasePositions.slice(index, index + 1),
    interbaseYs: DATA.interbaseYs.slice(index, index + 1),
    interbaseLengths: DATA.interbaseLengths.slice(index, index + 1),
    interbaseFrequencies: DATA.interbaseFrequencies.slice(index, index + 1),
    numInsertions: 0,
    numSoftclips: soft ? 1 : 0,
    numHardclips: soft ? 0 : 1,
  }
}

function drawnRect(index: number, reversed: boolean) {
  return painted(reversed, oneClip(index)).rects[0]
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

function packed() {
  const buf = packClips(DATA)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const s32 = clipShader.INSTANCE_STRIDE_WORDS
  const F = clipShader.INSTANCE_OFFSET_U32
  const FF = clipShader.INSTANCE_OFFSET_F32
  const out: {
    position: number
    y: number
    kind: number
    frequency: number
  }[] = []
  for (let o = 0; o < u32.length; o += s32) {
    out.push({
      position: u32[o + F.position]!,
      y: u32[o + F.y]!,
      kind: u32[o + F.kind]!,
      frequency: f32[o + FF.frequency]!,
    })
  }
  return out
}

describe.each([false, true])('reversed: %s', reversed => {
  test('every hit is drawn, within the tolerance of its own bar', () => {
    let hits = 0
    for (let row = 0; row < DATA.interbaseYs.length; row++) {
      for (let x = 0; x <= BLOCK_WIDTH; x += 0.25) {
        const hit = hitTestClip(
          resolvedBlock(reversed),
          coordsAt(x, row, reversed),
          true,
        )
        if (hit) {
          hits++
          // The sub-range bound, swept: the insertion at index 0 shares this
          // array and row 0, and neither clip mark owns it.
          expect(hit.index).toBeGreaterThanOrEqual(INS_END)
          // The kind is the slice the index fell in, so a bar's hit kind and its
          // drawn colour cannot disagree.
          expect(hit.type).toBe(hit.index < SC_END ? 'softclip' : 'hardclip')
          const rect = drawnRect(hit.index, reversed)
          expect(rect).toBeDefined()
          expect(x + HIT_TOLERANCE_PX + EPS).toBeGreaterThanOrEqual(rect!.x)
          expect(x - HIT_TOLERANCE_PX - EPS).toBeLessThanOrEqual(
            rect!.x + rect!.w,
          )
          expect(rect!.y).toBeGreaterThanOrEqual(row * FEATURE_HEIGHT)
          expect(rect!.y + rect!.h).toBeLessThanOrEqual(
            (row + 1) * FEATURE_HEIGHT,
          )
        }
      }
    }
    expect(hits).toBeGreaterThan(0)
  })

  test.each([
    ['softclip', 1],
    ['hardclip', 4],
  ])('a drawn %s is hittable at the center of its bar', (_name, index) => {
    const rect = drawnRect(index, reversed)!
    const hit = hitTestClip(
      resolvedBlock(reversed),
      coordsAt(rect.x + rect.w / 2, DATA.interbaseYs[index]!, reversed),
      true,
    )
    expect(hit?.index).toBe(index)
  })

  // The array's layout is the priority, not scan order: indices 3 and 5 are one
  // softclip and one hardclip on the same row at the same bp.
  test('a softclip outranks a hardclip at the same row and position', () => {
    const rect = drawnRect(3, reversed)!
    const hit = hitTestClip(
      resolvedBlock(reversed),
      coordsAt(rect.x + rect.w / 2, DATA.interbaseYs[3]!, reversed),
      true,
    )
    expect(hit?.type).toBe('softclip')
    expect(hit?.index).toBe(3)
  })

  // Pack against draw, over both kinds at once: the buffer holds the softclips
  // then the hardclips, each carrying the bp the painter centred its bar on.
  test('each instance names the bp the painter centred its bar on', () => {
    const { rects, softCount } = painted(reversed)
    const instances = packed()
    expect(instances).toHaveLength(HC_END - INS_END)
    expect(rects).toHaveLength(instances.length)
    expect(softCount).toBe(SC_END - INS_END)
    for (const [i, instance] of instances.entries()) {
      const rect = rects[i]!
      expect(bpAtPxExact(rect.x + rect.w / 2, bounds(reversed))).toBeCloseTo(
        instance.position,
        9,
      )
      expect(instance.y).toBe(DATA.interbaseYs[i + INS_END]!)
      expect(instance.kind).toBe(i < softCount ? 0 : 1)
    }
  })
})

// The divergence that is not drift. Index 2 is a softclip the worker zeroed:
// clip.slang goes on painting it at the fade's floor, and it must answer
// nothing.
test('a clip below the frequency threshold is drawn and not hittable', () => {
  const rect = drawnRect(2, false)!
  expect(rect).toBeDefined()
  expect(
    hitTestClip(
      resolvedBlock(false),
      coordsAt(rect.x + rect.w / 2, 2, false),
      true,
    ),
  ).toBeUndefined()
})

test('with frequency filtering off it answers again', () => {
  const rect = drawnRect(2, false)!
  expect(
    hitTestClip(
      resolvedBlock(false),
      coordsAt(rect.x + rect.w / 2, 2, false),
      false,
    )?.index,
  ).toBe(2)
})
