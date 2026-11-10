import { paintMarkBlocks } from '@jbrowse/render-core/marks'

// What a compacted transcript row has to keep true: everything drawn on the body
// stays on the body. At superCompact's 3px body one pixel is a third of the
// glyph, which is where both halves of it come apart.
import { HEIGHT_MULTIPLIERS } from '../../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { BASIC_FEATURE_MARKS } from '../marks/basicFeatureMarks.ts'
import { RECT_FLAG_INSET } from './sharedRendererConstants.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

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
  lineColors: new Uint32Array(),
  lineDirections: new Int8Array(),
  arrowXs: new Uint32Array(),
  arrowYs: new Float32Array(),
  arrowHeights: new Float32Array(),
  arrowWidthsBp: new Uint32Array(),
  arrowGene: new Uint8Array(),
  arrowDirections: new Int8Array(),
  arrowColors: new Uint32Array(),
} satisfies RegionRenderData

// The three primitives a coding transcript emits: a CDS box, a UTR box on the
// same row, and the strand arrow off the row's right edge.
function drawTranscriptRow(rowTop: number, bodyHeight: number) {
  const boxes: { y: number; h: number }[] = []
  let stemY: number | undefined
  let head: { top: number; bottom: number } | undefined
  let pathYs: number[] = []
  const ctx = {
    save() {},
    restore() {},
    clip() {},
    rect() {},
    beginPath() {
      pathYs = []
    },
    moveTo(_x: number, y: number) {
      pathYs.push(y)
    },
    lineTo(_x: number, y: number) {
      pathYs.push(y)
    },
    closePath() {},
    stroke() {},
    fill() {
      // The arrowhead is the only filled path this region produces.
      if (pathYs.length === 3) {
        head = { top: Math.min(...pathYs), bottom: Math.max(...pathYs) }
      }
    },
    fillRect(_x: number, y: number, _w: number, h: number) {
      // The arrow's stem is a fillRect too: 1px tall, after both boxes.
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

  const block: RenderBlock = {
    displayedRegionIndex: 0,
    start: 0,
    end: 800,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
  }
  const region: RegionRenderData = {
    ...EMPTY,
    rectPositions: new Uint32Array([100, 300, 300, 500]),
    rectYs: new Float32Array([rowTop, rowTop]),
    rectHeights: new Float32Array([bodyHeight, bodyHeight]),
    rectColors: new Uint32Array([0xff_00_00_00, 0xff_00_00_00]),
    rectStrands: new Float32Array([1, 1]),
    rectDensityFade: new Uint32Array([0, RECT_FLAG_INSET]),
    arrowXs: new Uint32Array([500]),
    arrowYs: new Float32Array([rowTop + bodyHeight / 2]),
    arrowHeights: new Float32Array([bodyHeight]),
    arrowWidthsBp: new Uint32Array([400]),
    arrowGene: new Uint8Array([0]),
    arrowDirections: new Int8Array([1]),
    arrowColors: new Uint32Array([0xff_00_00_00]),
  }
  paintMarkBlocks(ctx, BASIC_FEATURE_MARKS, new Map([[0, region]]), [block], {
    scrollY: 0,
    canvasWidth: 800,
    canvasHeight: 60,
    outlineColor: 0,
  })
  const [cds, utr] = boxes
  if (!cds || !utr || stemY === undefined || !head) {
    throw new Error('expected two boxes and an arrow')
  }
  return { cds, utr, stemTop: stemY, head }
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
      // An odd box inside an even row, or the reverse, has to spend its last
      // pixel on one side.
      expect(Math.abs(above - below)).toBeLessThanOrEqual(1)
    }
  },
)

test.each(BODY_HEIGHTS)(
  'a %s UTR draws thinner than its CDS',
  (_mode, bodyHeight) => {
    for (const rowTop of [0, 12, 20.4]) {
      const { cds, utr } = drawTranscriptRow(rowTop, bodyHeight)
      expect(utr.h).toBeLessThanOrEqual(cds.h - 2)
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

test.each(BODY_HEIGHTS)(
  'a %s arrowhead is no taller than the feature it marks',
  (_mode, bodyHeight) => {
    for (const rowTop of [0, 12, 20.4]) {
      const { cds, head } = drawTranscriptRow(rowTop, bodyHeight)
      expect(head.top).toBeGreaterThanOrEqual(cds.y)
      expect(head.bottom).toBeLessThanOrEqual(cds.y + cds.h)
    }
  },
)

function edgeMarkerRows(rowTop: number, bodyHeight: number) {
  const fills: { y: number; h: number }[] = []
  const strokedYs: number[] = []
  let pathYs: number[] = []
  const ctx = {
    save() {},
    restore() {},
    clip() {},
    rect() {},
    beginPath() {
      pathYs = []
    },
    moveTo(_x: number, y: number) {
      pathYs.push(y)
    },
    lineTo(_x: number, y: number) {
      pathYs.push(y)
    },
    closePath() {},
    stroke() {
      strokedYs.push(...pathYs)
    },
    fill() {},
    fillRect(_x: number, y: number, _w: number, h: number) {
      fills.push({ y, h })
    },
    strokeRect() {},
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  } as unknown as Ctx2D

  const block: RenderBlock = {
    displayedRegionIndex: 0,
    start: 0,
    end: 800,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
  }
  const region: RegionRenderData = {
    ...EMPTY,
    rectPositions: new Uint32Array([600, 1000]),
    rectYs: new Float32Array([rowTop]),
    rectHeights: new Float32Array([bodyHeight]),
    rectColors: new Uint32Array([0xff_00_00_00]),
    rectStrands: new Float32Array([1]),
    rectDensityFade: new Uint32Array([RECT_FLAG_INSET]),
  }
  paintMarkBlocks(ctx, BASIC_FEATURE_MARKS, new Map([[0, region]]), [block], {
    scrollY: 0,
    canvasWidth: 800,
    canvasHeight: 60,
    outlineColor: 0,
  })
  const [box] = fills
  if (!box || strokedYs.length === 0) {
    throw new Error('expected a box and its edge marker')
  }
  return { box, top: Math.min(...strokedYs), bottom: Math.max(...strokedYs) }
}

test.each(BODY_HEIGHTS)(
  'a %s UTR running off the canvas keeps its edge marker inside it',
  (_mode, bodyHeight) => {
    for (const rowTop of [0, 12, 20.4]) {
      const { box, top, bottom } = edgeMarkerRows(rowTop, bodyHeight)
      // An even box's centre row sits half a pixel off its middle.
      expect(top).toBeGreaterThanOrEqual(box.y - 0.5)
      expect(bottom).toBeLessThanOrEqual(box.y + box.h + 0.5)
    }
  },
)
