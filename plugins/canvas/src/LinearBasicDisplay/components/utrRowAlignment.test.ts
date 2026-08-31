// A UTR is emitted as a box centered inside its transcript's row at
// UTR_HEIGHT_FRACTION of the body (centerShrink), so it has to draw inside the
// rows the CDS beside it draws on. It did not: the rect raster rounded the
// shrunken top and the shrunken height independently, and `snapBoxHeightPx`'s
// odd-height nudge grows a thin box downward only — so at superCompact's 3px
// body the 1.95px UTR came out 3px tall starting a pixel low, hanging below the
// CDS with the intron line and strand arrow sitting on its top edge.
import {
  UTR_HEIGHT_FRACTION,
  centerShrink,
} from '../../RenderFeatureDataRPC/collect/emitPrimitives.ts'
import { HEIGHT_MULTIPLIERS } from '../../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { drawFeatureBlocks } from './Canvas2DFeatureRenderer.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureRenderBlock } from './canvasFeatureRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const EMPTY = {
  rectPositions: new Uint32Array(),
  rectYs: new Float32Array(),
  rectHeights: new Float32Array(),
  rectColors: new Uint32Array(),
  rectStrands: new Float32Array(),
  rectDensityFade: new Uint32Array(),
  outlineColor: 0,
  linePositions: new Uint32Array(),
  lineYs: new Float32Array(),
  lineHeights: new Float32Array(),
  lineColors: new Uint32Array(),
  lineDirections: new Int8Array(),
  arrowXs: new Uint32Array(),
  arrowYs: new Float32Array(),
  arrowHeights: new Float32Array(),
  arrowWidthsBp: new Uint32Array(),
  arrowDirections: new Int8Array(),
  arrowColors: new Uint32Array(),
} satisfies RegionRenderData

// One CDS box and one UTR box on the same transcript row, plus the strand arrow
// off the row's right edge — the three primitives processTranscriptLayout emits
// for a coding transcript, at the body height `displayMode` scales to.
function drawTranscriptRow(rowTop: number, bodyHeight: number) {
  const boxes: { y: number; h: number }[] = []
  let stemY: number | undefined
  const ctx = {
    save() {},
    restore() {},
    clip() {},
    rect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
    fill() {},
    fillRect(_x: number, y: number, _w: number, h: number) {
      // The arrow paints its stem with fillRect too; it is 1px tall and comes
      // after both boxes, so it is the last call and never one of them.
      if (h === 1 && boxes.length === 2) {
        stemY = y
      } else {
        boxes.push({ y, h })
      }
    },
    strokeRect() {},
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  } as unknown as Ctx2D

  const block: FeatureRenderBlock = {
    displayedRegionIndex: 0,
    start: 0,
    end: 800,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
  }
  const [utrTop, utrHeight] = centerShrink(
    rowTop,
    bodyHeight,
    UTR_HEIGHT_FRACTION,
  )
  const region: RegionRenderData = {
    ...EMPTY,
    rectPositions: new Uint32Array([100, 300, 300, 500]),
    rectYs: new Float32Array([rowTop, utrTop]),
    rectHeights: new Float32Array([bodyHeight, utrHeight]),
    rectColors: new Uint32Array([0xff_00_00_00, 0xff_00_00_00]),
    rectStrands: new Float32Array([1, 1]),
    rectDensityFade: new Uint32Array([0, 0]),
    arrowXs: new Uint32Array([500]),
    arrowYs: new Float32Array([rowTop + bodyHeight / 2]),
    arrowHeights: new Float32Array([bodyHeight]),
    arrowWidthsBp: new Uint32Array([400]),
    arrowDirections: new Int8Array([1]),
    arrowColors: new Uint32Array([0xff_00_00_00]),
  }
  drawFeatureBlocks(ctx, new Map([[0, region]]), [block], {
    scrollY: 0,
    canvasWidth: 800,
    canvasHeight: 60,
  })
  const [cds, utr] = boxes
  if (!cds || !utr || stemY === undefined) {
    throw new Error('expected two boxes and an arrow stem')
  }
  return { cds, utr, stemTop: stemY }
}

const BODY_HEIGHTS = Object.entries(HEIGHT_MULTIPLIERS).map(
  ([mode, multiplier]) => [mode, 10 * multiplier] as const,
)

test.each(BODY_HEIGHTS)(
  'a %s UTR draws inside the rows its CDS draws on',
  (_mode, bodyHeight) => {
    for (const rowTop of [0, 12, 20.4]) {
      const { cds, utr } = drawTranscriptRow(rowTop, bodyHeight)
      const above = utr.y - cds.y
      const below = cds.y + cds.h - (utr.y + utr.h)
      expect(above).toBeGreaterThanOrEqual(0)
      expect(below).toBeGreaterThanOrEqual(0)
      // Centered, to the pixel the parities allow: an odd box inside an even
      // row (or the reverse) has to spend its last pixel on one side.
      expect(Math.abs(above - below)).toBeLessThanOrEqual(1)
    }
  },
)

test.each(BODY_HEIGHTS)(
  'a %s strand arrow rides a row both boxes cover',
  (_mode, bodyHeight) => {
    for (const rowTop of [0, 12, 20.4]) {
      const { cds, utr, stemTop } = drawTranscriptRow(rowTop, bodyHeight)
      for (const box of [cds, utr]) {
        expect(stemTop).toBeGreaterThanOrEqual(box.y)
        expect(stemTop + 1).toBeLessThanOrEqual(box.y + box.h)
      }
    }
  },
)
