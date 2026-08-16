import { MockHal } from '@jbrowse/render-core/hal'

import {
  CANVAS_FEATURE_PASSES,
  GpuCanvasFeatureRenderer,
} from './GpuCanvasFeatureRenderer.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  FeatureRenderBlock,
  RenderState,
} from './canvasFeatureRenderingBackendTypes.ts'

// What reaches the GPU per region, and which buffer each pass draws from. Both
// halves are invisible to every other test in this plugin: the Canvas2D path is
// what the parity and snapshot tests exercise, so an extra upload or a pass
// pointed at the wrong buffer costs nothing there and shows up only as garbage
// glyphs on a GPU machine.

const REGION = 0

function regionData(numRects: number, over: Partial<RegionRenderData> = {}) {
  const positions = new Uint32Array(numRects * 2)
  for (let i = 0; i < numRects; i++) {
    positions[i * 2] = 100 + i * 10
    positions[i * 2 + 1] = 105 + i * 10
  }
  return {
    rectPositions: positions,
    rectYs: new Float32Array(numRects),
    rectHeights: new Float32Array(numRects).fill(10),
    rectColors: new Uint32Array(numRects).fill(0xff00_00ff),
    rectStrands: new Float32Array(numRects).fill(1),
    rectDensityFade: new Uint32Array(numRects),
    outlineColor: 0,
    linePositions: new Uint32Array(0),
    lineYs: new Float32Array(0),
    lineHeights: new Float32Array(0),
    lineColors: new Uint32Array(0),
    lineDirections: new Int8Array(0),
    arrowXs: new Uint32Array(0),
    arrowYs: new Float32Array(0),
    arrowHeights: new Float32Array(0),
    arrowWidthsBp: new Uint32Array(0),
    arrowDirections: new Int8Array(0),
    arrowColors: new Uint32Array(0),
    ...over,
  } satisfies RegionRenderData
}

const STATE: RenderState = {
  canvasWidth: 800,
  canvasHeight: 100,
  scrollY: 0,
}

// A block filling the canvas, so both of its edges are canvas edges and the
// continuation pass is drawn. `screenStartPx`/`screenEndPx` inside the canvas
// would make it an interior block, which is the skip case asserted below.
function block(over: Partial<FeatureRenderBlock> = {}): FeatureRenderBlock {
  return {
    displayedRegionIndex: REGION,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
    ...over,
  }
}

function setup() {
  const hal = new MockHal(CANVAS_FEATURE_PASSES)
  return { hal, renderer: new GpuCanvasFeatureRenderer(hal) }
}

function callsTo(hal: MockHal, method: string) {
  return hal.calls.filter(c => c.method === method)
}

describe('per-region uploads', () => {
  it('uploads ONE buffer for the rects, not one per pass that reads them', () => {
    const { hal, renderer } = setup()
    renderer.uploadRegion(REGION, regionData(4))
    const uploads = callsTo(hal, 'uploadBuffer')
    // [regionKey, passId, byteLength, count]. One upload per pass that owns a
    // buffer — continuation is not among them, it draws from rect's.
    expect(uploads.map(c => c.args[1])).toStrictEqual(['rect', 'line', 'arrow'])
    expect(uploads[0]!.args[3]).toBe(4)
  })

  it('packs the strand the continuation pass needs into that one buffer', () => {
    const { hal, renderer } = setup()
    renderer.uploadRegion(REGION, regionData(3))
    const [upload] = callsTo(hal, 'uploadBuffer')
    // 3 instances x 28 bytes: startEnd(8) y(4) height(4) color(4)
    // densityFade(4) strand(4). The strand is what makes one buffer serve both
    // passes; drop it and the stride falls back to 24.
    expect(upload!.args[2]).toBe(3 * 28)
  })

  it('uploads no instances for an empty region', () => {
    const { hal, renderer } = setup()
    renderer.uploadRegion(REGION, regionData(0))
    // An empty pack is uploaded rather than skipped — that is how a pass whose
    // data went empty stops drawing its last buffer (see `uploadPass`).
    expect(callsTo(hal, 'uploadBuffer').map(c => c.args[3])).toStrictEqual([
      0, 0, 0,
    ])
  })
})

describe('draw passes', () => {
  it('draws the borrowing passes from the lender’s buffer', () => {
    const { hal, renderer } = setup()
    renderer.uploadRegion(REGION, regionData(2))
    renderer.renderBlocks([block()], new Map([[REGION, regionData(2)]]), STATE)
    // [passId, regionKey, bufferPassId]
    expect(
      callsTo(hal, 'drawPass').map(c => [c.args[0], c.args[2]]),
    ).toStrictEqual([
      ['line', undefined],
      ['chevron', 'line'],
      ['rect', undefined],
      ['arrow', undefined],
      ['continuation', 'rect'],
    ])
  })

  it('draws every pass it registers', () => {
    const { hal, renderer } = setup()
    // Every glyph family populated and a block on both canvas edges, so nothing
    // is absent for want of data or of an edge.
    const data = regionData(2, {
      linePositions: new Uint32Array([100, 200, 300, 400]),
      lineYs: new Float32Array(2),
      lineHeights: new Float32Array(2).fill(10),
      lineColors: new Uint32Array(2).fill(0xff00_00ff),
      lineDirections: new Int8Array(2).fill(1),
      arrowXs: new Uint32Array([150, 350]),
      arrowYs: new Float32Array(2),
      arrowHeights: new Float32Array(2).fill(10),
      arrowWidthsBp: new Uint32Array(2).fill(50),
      arrowDirections: new Int8Array(2).fill(1),
      arrowColors: new Uint32Array(2).fill(0xff00_00ff),
    })
    renderer.uploadRegion(REGION, data)
    renderer.renderBlocks([block()], new Map([[REGION, data]]), STATE)

    // `GLYPH_LAYERS` is what the renderer walks, and each id resolves to one or
    // two `drawPass` calls — so a pass added to `CANVAS_FEATURE_PASSES` and
    // missed in `GPU_GLYPH_DRAW` registers, compiles and never draws. The
    // typed records catch a missing LAYER; nothing but this catches a pass with
    // no layer to carry it.
    expect(new Set(callsTo(hal, 'drawPass').map(c => c.args[0]))).toStrictEqual(
      new Set(CANVAS_FEATURE_PASSES.map(p => p.id)),
    )
  })

  it('skips the continuation pass on an interior block', () => {
    const { hal, renderer } = setup()
    renderer.uploadRegion(REGION, regionData(2))
    // Neither edge touches the canvas edge, so no instance could qualify and
    // shading one per rect would be pure waste.
    renderer.renderBlocks(
      [block({ screenStartPx: 100, screenEndPx: 400 })],
      new Map([[REGION, regionData(2)]]),
      STATE,
    )
    expect(callsTo(hal, 'drawPass').map(c => c.args[0])).not.toContain(
      'continuation',
    )
  })
})
