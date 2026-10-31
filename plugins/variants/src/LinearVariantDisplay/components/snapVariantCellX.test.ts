import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { backingScale, makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import { cellMark } from './cellMark.ts'
import {
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32 as U,
} from './shaders/variant.generated.ts'
import {
  snappedCellLeftPx,
  snappedCellWidthPx,
} from './shaders/variant.js.generated.ts'
import { snapVariantCellX } from './snapVariantCellX.ts'

import type { CellChannels } from './cellMark.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

function withDpr<T>(dpr: number, run: () => T) {
  const before = window.devicePixelRatio
  window.devicePixelRatio = dpr
  try {
    return run()
  } finally {
    window.devicePixelRatio = before
  }
}

// variant.slang's vertex x, from the uniforms `cellMark.writeUniforms` hands
// it: clip x back to canvas px across the block's CSS viewport, then the snap.
// Returns the device px the rasterizer puts the cell's sides on, through the
// viewport the HAL actually sets (`clip.pxX`, `clip.pxW`).
//
// The anchor is chosen from the RAW edges, not the snapped ones: a sub-pixel
// record snaps both of its edges onto one pixel, and that is every record at
// genome-wide zoom.
function shaderDeviceEdges(
  u: Float32Array,
  viewport: { pxX: number; pxW: number },
  x1: number,
  x2: number,
) {
  const left = u[U.viewportLeft]!
  const width = u[U.viewportWidth]!
  const toClip = (px: number) => ((px - left) / width) * 2 - 1
  const toCanvasPx = (clip: number) => clip / (2 / width) + left + width / 2
  const r1 = toCanvasPx(toClip(x1))
  const r2 = toCanvasPx(toClip(x2))
  const sx = u[U.scaleX]!
  const w = snappedCellWidthPx(r1, r2, sx)
  const l = snappedCellLeftPx(r1, r2, w, sx)
  const deviceLeft = u[U.viewportDeviceLeft]!
  const deviceWidth = u[U.viewportDeviceWidth]!
  const toDevice = (px: number) => {
    const clip = ((px * sx - deviceLeft) / deviceWidth) * 2 - 1
    return ((clip + 1) / 2) * viewport.pxW + viewport.pxX
  }
  return [toDevice(l), toDevice(l + w)] as const
}

const FRAME = { canvasWidth: 1203, canvasHeight: 300 }
const PARAMS = { rowHeight: 10, scrollTop: 0 }

function oneCell(start: number, end: number): CellChannels {
  return {
    startEnd: new Uint32Array([start, end]),
    row: new Uint32Array([0]),
    shapeType: new Uint8Array([0]),
    color: new Uint32Array([0xff0000ff]),
    count: 1,
  }
}

// The block's left edge lands mid-device-pixel at 1.25, 1.5 and 1.75 (37 * 1.5
// = 55.5), so the GPU's viewport starts a fraction of a device pixel off the
// canvas's own grid.
describe.each([false, true])(
  'a cell sits on the device grid on GPU and Canvas2D, reversed %s',
  reversed => {
    const block: RenderBlock = {
      displayedRegionIndex: 0,
      start: 10_000,
      end: 13_000,
      screenStartPx: 37.4,
      screenEndPx: 1180.6,
      reversed,
    }
    test.each([1, 1.25, 1.5, 1.75, 2])('at dpr %d', dpr => {
      withDpr(dpr, () => {
        const sx = backingScale(FRAME.canvasWidth)
        const clip = clipBlock(block, FRAME.canvasWidth, FRAME.canvasHeight, {
          x: sx,
          y: backingScale(FRAME.canvasHeight),
        })!
        const scratch = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
        cellMark.writeUniforms(scratch, clip, block, FRAME, PARAMS)
        const u = new Float32Array(scratch)
        const toX = makeBpMapper(block)
        for (let bp = 10_050; bp < 12_950; bp += 37) {
          for (const len of [0, 1, 3, 40]) {
            const ink = cellMark.ink!(
              oneCell(bp, bp + len),
              block,
              FRAME,
              PARAMS,
              0,
            )!
            const cpu = [ink.left * sx, (ink.left + ink.width) * sx]
            const gpu = shaderDeviceEdges(u, clip, toX(bp), toX(bp + len))
            expect(cpu[0]).toBeCloseTo(Math.round(cpu[0]!), 3)
            expect(cpu[1]).toBeCloseTo(Math.round(cpu[1]!), 3)
            expect(gpu[0]).toBeCloseTo(cpu[0]!, 2)
            expect(gpu[1]).toBeCloseTo(cpu[1]!, 2)
            expect(ink.width).toBeGreaterThanOrEqual(2)
          }
        }
      })
    })
  },
)

describe('snapVariantCellX', () => {
  test('a cell edge is a whole device pixel at a fractional dpr', () => {
    for (const dpr of [1.25, 1.5, 1.75]) {
      for (let i = 0; i < 50; i++) {
        const { x, width } = snapVariantCellX(i * 7.3 + 0.2, i * 7.3 + 3.9, dpr)
        expect(x * dpr).toBeCloseTo(Math.round(x * dpr), 6)
        expect(width * dpr).toBeCloseTo(Math.round(width * dpr), 6)
      }
    }
  })

  test('a wide span is the same cell whichever way the block runs', () => {
    // The floor does nothing here, so the anchor is moot: both spellings land on
    // the leftmost snapped edge.
    expect(snapVariantCellX(100, 40, 1)).toEqual(snapVariantCellX(40, 100, 1))
  })

  test('a sub-pixel cell keeps the 2px visibility floor', () => {
    expect(snapVariantCellX(10.2, 10.3, 1).width).toBe(2)
    expect(snapVariantCellX(10.2, 10.3, 1.5).width).toBe(2)
    // 2.5 device px rounds up to 3, so the floor stays on the grid
    expect(snapVariantCellX(10.2, 10.3, 1.25).width).toBeCloseTo(2.4)
  })

  test('a wide cell is not padded to the floor', () => {
    const { x, width } = snapVariantCellX(10.4, 50.6, 1)
    expect(x).toBe(10)
    expect(width).toBe(41)
  })

  // The reversed-block family (`spanLeft`, `extendToMinWidthPx`): a mark widened
  // to a floor grows *away from the record's start*, and on a flipped block the
  // start is the right edge. Anchoring the leftmost edge instead is identical
  // forward and slides every sub-pixel cell a full 2px toward the block's end
  // when reversed — which is where the ruler, and the same VCF in a
  // LinearVariantDisplay beside it, are not.
  describe('the 2px floor grows away from the record start', () => {
    test('forward: the cell hangs to the right of the start', () => {
      // start snaps to 10, end is under a pixel past it
      expect(snapVariantCellX(10.2, 10.3, 1)).toEqual({ x: 10, width: 2 })
    })

    test('reversed: the cell hangs to the left of the start', () => {
      // same record on a flipped block — start is now the RIGHT edge at 10, so
      // the cell is [8, 10). Anchoring min() would put it at [9, 11).
      expect(snapVariantCellX(10.3, 10.2, 1)).toEqual({ x: 8, width: 2 })
    })

    test('the start edge bounds the cell in both orientations', () => {
      for (const dpr of [1, 1.5]) {
        for (const [x1, x2] of [
          [10.2, 10.3],
          [10.3, 10.2],
          [500.6, 500.1],
        ] as const) {
          const { x, width } = snapVariantCellX(x1, x2, dpr)
          const start = Math.round(x1 * dpr) / dpr
          expect(x).toBeLessThanOrEqual(start)
          expect(x + width).toBeGreaterThanOrEqual(start)
        }
      }
    })
  })
})
