import { MockHal } from '@jbrowse/render-core/hal'

import { resolveArcBandDebug } from '../../LinearAlignmentsDisplay/components/arcHitTest.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from '../../LinearAlignmentsDisplay/renderers/GpuAlignmentsRenderer.ts'
import { paintArcBand } from '../../LinearAlignmentsDisplay/renderers/arcMarks.ts'
import {
  makeTestPalette,
  makeTestRenderState,
} from '../../LinearAlignmentsDisplay/testUtils.ts'
import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { ARC_FAR_SCREEN_WIDTHS } from '../../shaders/slang/arc.consts.generated.ts'
import * as glsl from '../../shaders/slang/arc.glsl.generated.ts'
import { UNIFORM_OFFSET_F32 } from '../../shaders/slang/arc.iface.generated.ts'
import * as wgsl from '../../shaders/slang/arc.wgsl.generated.ts'
import { arcMarkFrom } from './mark.ts'
import { ARC_SHAPE_ARC } from './shapes.ts'
import { emptyArcsUploadData } from './types.ts'

import type { ArcHitBandOptions } from '../../LinearAlignmentsDisplay/components/arcHitTest.ts'
import type {
  AlignmentsSources,
  SectionRender,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ArcBandFrame } from './mark.ts'
import type { ArcsUploadData } from './types.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * Which width `arcIsFar` measures a pair against.
 *
 * The whole surface the mark is drawn across, so a pair is the same shape
 * wherever the block edges fall. For these three consumers that surface is the
 * track canvas; `CrossRegionArcsOverlay` paints on the view's own box and is
 * pinned in `crossRegionArcs.test.ts`. Measured against a BLOCK, the threshold
 * moves as a region edge scrolls on screen — near a chromosome end, or in any
 * multi-region view — and a settled arc is redrawn as a different mark partway
 * through a pan. ADR-163 settled this for the link mark; the band was the copy
 * still measuring its block.
 */

const CANVAS_W = 800
const BLOCK_W = 400
const BAND_H = 100
// A pair spanning 2.5 canvas widths: inside the threshold against the canvas,
// past it against a half-width block.
const SPAN_PX = 2.5 * CANVAS_W

const frame = (viewWidthPx: number): Omit<ArcBandFrame, 'bpToScreenX'> => ({
  arcsYDomainBp: 1000,
  arcsYLog: false,
  arcsTop: 0,
  arcsH: BAND_H,
  pairedArcsDown: false,
  viewWidthPx,
})

function dome(viewWidthPx: number) {
  const mark = arcMarkFrom(
    { sx1: 0, sx2: SPAN_PX, yBp: 500, shapeType: ARC_SHAPE_ARC },
    frame(viewWidthPx),
  )
  if (mark.kind !== 'dome') {
    throw new Error('expected a dome')
  }
  return mark
}

test('the pair this file is about straddles the threshold', () => {
  // Both readings, so the cases below are known to be measuring something.
  // `circular` IS the far branch: it collapses `ry` onto `rx`.
  expect(SPAN_PX).toBeLessThan(ARC_FAR_SCREEN_WIDTHS * CANVAS_W)
  expect(SPAN_PX).toBeGreaterThan(ARC_FAR_SCREEN_WIDTHS * BLOCK_W)
  expect(dome(CANVAS_W).circular).toBe(false)
  expect(dome(BLOCK_W).circular).toBe(true)
})

// ---- the three consumers, each handed a block half the view wide ----------

const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 1000,
  end: 2000,
  screenStartPx: 0,
  screenEndPx: BLOCK_W,
  reversed: false,
}

// One arc spanning SPAN_PX on screen: the block is 1bp per 0.4px, so the mates
// are 5000bp apart.
function oneArc(): ArcsUploadData {
  return {
    ...emptyArcsUploadData(),
    arcX1: new Uint32Array([1000]),
    arcX2: new Uint32Array([1000 + SPAN_PX / (BLOCK_W / 1000)]),
    arcYBp: new Uint32Array([500]),
    arcSpanBp: new Uint32Array([5000]),
    arcSupport: new Uint32Array([1]),
    arcShapeTypes: new Uint8Array([ARC_SHAPE_ARC]),
    arcColorTypes: new Uint8Array([0]),
    numArcs: 1,
  }
}

const SECTION: SectionRender = {
  pileupTopOffset: 0,
  coverageTopOffset: 0,
  covClipTop: 0,
  covClipHeight: 0,
  pileupClipTop: 0,
  pileupClipHeight: 0,
  arcBand: { top: 0, height: BAND_H, down: false },
}

function sources(): AlignmentsSources {
  return {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, makePileupDataResult({})]]),
        arcsRpcDataMap: new Map(),
      },
    ],
    densityRegions: new Map(),
    readConnectionsLineWidth: 1,
  }
}

test('the GPU carries the surface width beside the block clip, not instead of it', () => {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  renderer.upload('sources', sources())
  renderer.renderBlocks(
    [BLOCK],
    makeTestRenderState({
      canvasWidth: CANVAS_W,
      canvasHeight: 200,
      sections: [SECTION],
    }),
  )
  const u = hal.getUniformWritesF32().at(-1)!
  expect(u[UNIFORM_OFFSET_F32.viewWidthPx]).toBe(CANVAS_W)
  // Still the block's span: clip space normalizes over the scissor, and the
  // two uniforms have to be able to differ for that to keep working.
  expect(u[UNIFORM_OFFSET_F32.canvasW]).toBe(BLOCK_W)
})

function ellipses() {
  const drawn: [number, number, number, number][] = []
  const ctx = {
    set strokeStyle(_v: string) {},
    set fillStyle(_v: string) {},
    set lineWidth(_v: number) {},
    setLineDash() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    ellipse(cx: number, cy: number, rx: number, ry: number) {
      drawn.push([cx, cy, rx, ry])
    },
    stroke() {},
    fillRect() {},
  } as unknown as MarkContext2D
  return { ctx, drawn }
}

test('the Canvas2D painter strokes the dome the canvas width earns', () => {
  const { ctx, drawn } = ellipses()
  paintArcBand(ctx, oneArc(), BLOCK, {
    ...makeTestRenderState({
      canvasWidth: CANVAS_W,
      colors: makeTestPalette(),
      readConnectionsLineWidth: 1,
    }),
    arcBand: SECTION.arcBand!,
  })
  const [, , rx, ry] = drawn[0]!
  expect(rx).toBeCloseTo(SPAN_PX / 2, 6)
  // The far branch returns `[rx, rx]`, so the two radii being equal IS that
  // branch — and the block's threshold is what would have taken it. The height
  // itself is the Y scale's, which this says nothing about.
  expect(ry).not.toBeCloseTo(rx, 6)
})

test('the hit test resolves that same dome, and still clips to the block', () => {
  const opts = {
    region: BLOCK,
    band: { arcBandTop: 0, arcBandHeight: BAND_H, arcDown: false },
    scroll: { isGrouped: false, scrollTop: 0, canvasHeight: 200 },
    lineWidth: 1,
    arcsYDomainBp: undefined,
    canvasWidthPx: CANVAS_W,
  } satisfies ArcHitBandOptions
  const debug = resolveArcBandDebug(oneArc(), opts)!
  const { mark } = debug.shapes[0]!
  expect(mark.kind === 'dome' && mark.circular).toBe(false)
  // The far test moved to the view's width; the band's rect did not. Both
  // used to be the one `screenWidthPx`, so widening the test would have
  // widened the overlay's clip over a block-clipped paint.
  expect(debug.clip.width).toBe(BLOCK_W)
})

/** The emitted body of `fn`, brace-matched, so a temp's name cannot matter. */
function bodyOf(src: string, fn: string) {
  const open = src.indexOf('{', src.indexOf(`${fn}(`))
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') {
      depth++
    } else if (src[i] === '}' && --depth === 0) {
      return src.slice(open, i + 1)
    }
  }
  throw new Error(`no body for ${fn}`)
}

// The three cases above pin the uniform, the painter and the hit test. This one
// pins the vertex stage, which has no JS twin and is the only consumer that
// could still read the block's width: swapping `u.viewWidthPx` back to
// `u.canvasW` in `arcCurve` — the whole of the regression — leaves every other
// assertion in the tree green.
test.each([
  ['wgsl', wgsl.WGSL_SOURCE],
  ['glsl', glsl.GLSL_VERTEX],
])('%s resolves the curve against the surface width alone', (_name, src) => {
  const body = bodyOf(src, 'arcCurve_0')
  expect(body).toContain('viewWidthPx')
  // `canvasW` is the block's clamped span and belongs to `arcBandClipPos`,
  // which vs_main calls after the curve is resolved. Inside the curve it could
  // only be the far test reading the wrong width.
  expect(body).not.toContain('canvasW')
})
