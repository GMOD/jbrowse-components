import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { bpAtPx } from '@jbrowse/render-core/canvas2dUtils'

import * as packedColorQuad from '../../shaders/slang/packedColorQuad.generated.ts'
import { drawPerBaseQuality } from './drawCanvas.ts'
import { packPerBaseQuality } from './packGpu.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PerBaseQualityUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Pack against draw, which is the third pairing and the one this layer can be
// held to: there is no hit test over these cells (the read body's answers), so
// the two consumers to keep in agreement are the GPU instance and the Canvas2D
// fill. Both now read `PER_BASE_QUALITY_MARK`, and the property is that the bp
// the vertex buffer carries is the base whose cell the painter fills — mapped
// back through `bpAtPx`, which is `makeCellLeftMapper`'s own inverse.
//
// `cellPainterParity.test.ts` pins the five painters to one geometry; nothing
// pinned a painter to the buffer beside it.

const START = 1000
const END = 1010
const BP_LENGTH = END - START
const BLOCK_WIDTH = 200
const FEATURE_HEIGHT = 10

const DATA: PerBaseQualityUploadData = {
  perBaseQualPositions: new Uint32Array([1000, 1004, 1005, 1009]),
  perBaseQualYs: new Uint16Array([0, 0, 1, 1]),
  perBaseQualScores: new Uint8Array([0, 20, 40, 255]),
}

function state(): RenderState {
  return {
    featureHeight: FEATURE_HEIGHT,
    featureSpacing: 0,
    pileupTopOffset: 0,
    scrollTop: 0,
    canvasHeight: 500,
  } as unknown as RenderState
}

function block(reversed: boolean): DrawBlock {
  return { start: START, end: END, screenStartPx: 0, reversed }
}

function bounds(reversed: boolean) {
  return {
    start: START,
    end: END,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
}

function recordingCtx() {
  const fills: { x: number; w: number; css: string }[] = []
  let css = ''
  const ctx = {
    set fillStyle(v: string) {
      css = v
    },
    get fillStyle() {
      return css
    },
    fillRect(x: number, _y: number, w: number) {
      fills.push({ x, w, css })
    },
  } as unknown as Ctx2D
  return { ctx, fills }
}

function painted(reversed: boolean) {
  const { ctx, fills } = recordingCtx()
  drawPerBaseQuality(
    ctx,
    DATA,
    block(reversed),
    BP_LENGTH,
    BLOCK_WIDTH,
    state(),
  )
  return fills
}

function packed() {
  const u32 = new Uint32Array(packPerBaseQuality(DATA))
  const s32 = packedColorQuad.INSTANCE_STRIDE_WORDS
  const F = packedColorQuad.INSTANCE_OFFSET_U32
  const out: { position: number; y: number; css: string }[] = []
  for (let o = 0; o < u32.length; o += s32) {
    out.push({
      position: u32[o + F.position]!,
      y: u32[o + F.y]!,
      css: abgrToCssRgba(u32[o + F.packedColor]!),
    })
  }
  return out
}

test('the buffer holds one instance per painted cell', () => {
  expect(packed()).toHaveLength(DATA.perBaseQualPositions.length)
  expect(painted(false)).toHaveLength(DATA.perBaseQualPositions.length)
})

describe.each([false, true])('reversed: %s', reversed => {
  test('each instance names the base whose cell the painter fills', () => {
    const fills = painted(reversed)
    for (const [i, instance] of packed().entries()) {
      const fill = fills[i]!
      // The centre of the drawn cell, back through the pivot the painter used.
      // A one-base disagreement is a 20px error here, not a rounding one.
      expect(bpAtPx(fill.x + fill.w / 2, bounds(reversed))).toBe(
        instance.position,
      )
      expect(instance.y).toBe(DATA.perBaseQualYs[i]!)
    }
  })

  test('the colour is one ramp, not two', () => {
    const fills = painted(reversed)
    for (const [i, instance] of packed().entries()) {
      expect(fills[i]!.css).toBe(instance.css)
    }
  })
})
