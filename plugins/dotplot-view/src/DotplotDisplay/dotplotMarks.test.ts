import { MockHal } from '@jbrowse/render-core/hal'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import { sweepDrawAgainstHit } from '@jbrowse/render-core/marks/drawAgainstHit'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import { DOTPLOT_MARKS, segmentMark } from './dotplotMarks.ts'
import {
  INSTANCE_OFFSET_F32 as F_F32,
  INSTANCE_OFFSET_U32 as F_U32,
  INSTANCE_STRIDE_WORDS,
  UNIFORM_OFFSET_F32 as U,
} from './shaders/dotplot.iface.generated.ts'
import { fakeDotplotInstanceData } from './testUtils.ts'

import type {
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotRenderingBackendTypes.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

const PASSES = DOTPLOT_MARKS.map(m => m.pass)

function makeGeometry(
  overrides: Partial<DotplotGeometryData> = {},
): DotplotGeometryData {
  return {
    ...fakeDotplotInstanceData(1, {
      x1: new Float64Array([100]),
      y1: new Float64Array([200]),
      x2: new Float64Array([150]),
      y2: new Float64Array([250]),
    }),
    colors: new Uint32Array([0xff0000ff]),
    ...overrides,
  }
}

// `n` segments 10 cumBp apart on both axes, all one color unless a test says
// otherwise. bpPerPx = 1 and the viewport at the origin, so cumBp reads as px.
function makeSegments(
  n: number,
  colors = new Uint32Array(n).fill(0xff0000ff),
): DotplotGeometryData {
  const data = fakeDotplotInstanceData(n)
  for (let i = 0; i < n; i++) {
    data.x1[i] = i * 10
    data.y1[i] = i * 10
    data.x2[i] = i * 10 + 5
    data.y2[i] = i * 10 + 5
  }
  return { ...data, colors }
}

function makeState(
  overrides: Partial<DotplotRenderState> = {},
): DotplotRenderState {
  return {
    viewBpH: 0,
    viewBpV: 0,
    bpPerPxHInv: 1,
    bpPerPxVInv: 1,
    lineWidth: 2,
    alpha: 1,
    canvasWidth: 800,
    canvasHeight: 600,
    ...overrides,
  }
}

function render(
  regions: ReadonlyMap<number, DotplotGeometryData>,
  state = makeState(),
) {
  const hal = new MockHal(PASSES)
  const backend = new GpuMarkBackend(hal, DOTPLOT_MARKS)
  for (const [key, data] of regions) {
    backend.upload(key, data)
  }
  const painted = backend.renderBlocks(
    canvasWideBlocks(regions.keys(), state.canvasWidth),
    regions,
    state,
  )
  return { hal, backend, painted }
}

describe('the dotplot mark list', () => {
  test('stores coords window-relative (cumBp - base) at upload', () => {
    const { hal } = render(
      new Map([
        [
          0,
          makeGeometry({
            x1: new Float64Array([8e8 + 100]),
            y1: new Float64Array([5e8 + 200]),
            baseH: 8e8,
            baseV: 5e8,
          }),
        ],
      ]),
    )
    const stored = new Float32Array(hal.getBuffer(0, 'line')!.data)
    expect(stored[F_F32.x1]).toBe(100)
    expect(stored[F_F32.y1]).toBe(200)
  })

  // panPx is the whole point of the window-relative scheme: it folds the
  // genome-scale (base - viewBp) delta on the CPU (float64) so a single Float32
  // coord projects correctly. base = 0 in the other fixtures, so this is the
  // only test exercising a non-trivial base.
  test('panPx projects a genome-scale coord to the correct screen X/Y', () => {
    const base = 1.5e9 // fetch-time base cumBp, past Float32 exact-int
    const offsetBp = base - 500 // view panned 500px past the base
    const { hal } = render(
      new Map([
        [
          0,
          makeGeometry({
            x1: new Float64Array([base + 300]),
            y1: new Float64Array([base + 700]),
            baseH: base,
            baseV: base,
          }),
        ],
      ]),
      makeState({ viewBpH: offsetBp, viewBpV: offsetBp }),
    )

    const u = hal.getLastUniformsF32()!
    // panPx = (base - viewBp)/bpPerPx = 500
    expect(u[U.panPxH]!).toBeCloseTo(500, 2)
    expect(u[U.panPxV]!).toBeCloseTo(500, 2)
    // screenX = xRel*bpPerPxInv + panPx == (cumBp - viewBp)/bpPerPx
    const xRel = Math.fround(base + 300 - base)
    const screenX = xRel * u[U.bpPerPxHInv]! + u[U.panPxH]!
    expect(screenX).toBeCloseTo(base + 300 - offsetBp, 2)
  })

  test('writes the resolution, stroke width and opacity of the frame', () => {
    const { hal } = render(
      new Map([[0, makeGeometry()]]),
      makeState({ lineWidth: 3, alpha: 0.25 }),
    )
    const u = hal.getLastUniformsF32()!
    expect(u[U.resolution]).toBe(800)
    expect(u[U.resolution + 1]).toBe(600)
    expect(u[U.lineWidth]).toBe(3)
    expect(u[U.alpha]).toBe(0.25)
  })

  // The shader's AA ramp is 0.5/dpr CSS px, because it measures in CSS px while
  // the viewport is device px. It cannot read the ratio itself, so a missing
  // write here leaves the uniform at 0 and the ramp at infinity — every line
  // would vanish. Same uniform, same reason, as the synteny passes.
  test('supplies the device pixel ratio the AA ramp is sized by', () => {
    const { hal } = render(new Map([[0, makeGeometry()]]))
    expect(hal.getLastUniformsF32()![U.devicePixelRatio]).toBeGreaterThan(0)
  })

  // One block per display, so each display's own base reaches the uniforms
  // rather than the last uploaded one's.
  test('each display uses its own base for panPx', () => {
    const { hal } = render(
      new Map([
        [7, makeGeometry({ baseH: 1000, baseV: 2000 })],
        [9, makeGeometry({ baseH: 3000, baseV: 4000 })],
      ]),
    )
    const draws = hal.draws()
    expect(draws.map(d => d.regionKey)).toEqual([7, 9])
    expect(hal.uniformsOf(draws[0]!)![U.panPxH]).toBeCloseTo(1000, 2)
    expect(hal.uniformsOf(draws[0]!)![U.panPxV]).toBeCloseTo(2000, 2)
    expect(hal.uniformsOf(draws[1]!)![U.panPxH]).toBeCloseTo(3000, 2)
    expect(hal.uniformsOf(draws[1]!)![U.panPxV]).toBeCloseTo(4000, 2)
  })

  // An empty pack IS the release, and the key stays in the map: the cleared
  // canvas is the picture for a window whose alignments were all filtered out,
  // so the frame still counts as drawn rather than parking the loading scrim.
  test('a fetched-but-empty geometry releases its buffer and still paints', () => {
    const hal = new MockHal(PASSES)
    const backend = new GpuMarkBackend(hal, DOTPLOT_MARKS)
    const regions = new Map([[0, makeGeometry()]])
    backend.upload(0, makeGeometry())
    expect(hal.getBuffer(0, 'line')).toBeDefined()

    const empty = makeGeometry({ instanceCount: 0 })
    regions.set(0, empty)
    backend.upload(0, empty)
    expect(hal.getBuffer(0, 'line')).toBeUndefined()

    const state = makeState()
    expect(
      backend.renderBlocks(
        canvasWideBlocks(regions.keys(), state.canvasWidth),
        regions,
        state,
      ),
    ).toBe(true)
  })

  test('instance stride is the single-float layout', () => {
    expect(INSTANCE_STRIDE_WORDS).toBe(5)
  })

  // Opacity rides a uniform rather than the packed color, so an opacity drag is
  // a uniform write — no recolor, no re-pack, no re-upload.
  test('the opacity slider writes a uniform and uploads nothing', () => {
    const hal = new MockHal(PASSES)
    const backend = new GpuMarkBackend(hal, DOTPLOT_MARKS)
    const regions = new Map([[0, makeGeometry()]])
    backend.upload(0, makeGeometry())
    hal.calls = []

    const state = makeState({ alpha: 0.25 })
    backend.renderBlocks(
      canvasWideBlocks(regions.keys(), state.canvasWidth),
      regions,
      state,
    )

    expect(hal.getLastUniformsF32()![U.alpha]).toBe(0.25)
    expect(hal.callsOf('uploadBuffer')).toEqual([])
  })
})

// The rpcProps/gpuProps split means a colorBy change hands the mark a new
// geometry object over the SAME coordinate arrays. The re-upload is unavoidable
// (the HAL has no partial-buffer update); re-packing the four coordinate lanes
// is not, and every upload calls `pack` — the mark backend's passes are walked
// by `GpuPerRegionRenderingBackend.upload` — so the fast path has to live
// inside it.
describe('the dotplot recolor path', () => {
  test('a colour-only change uploads once and repacks no coordinate lane', () => {
    const hal = new MockHal(PASSES)
    const backend = new GpuMarkBackend(hal, DOTPLOT_MARKS)
    const uploads = jest.spyOn(hal, 'uploadBuffer')
    const geom = makeGeometry({
      x1: new Float64Array([8e8 + 100]),
      y1: new Float64Array([5e8 + 200]),
      baseH: 8e8,
      baseV: 5e8,
    })
    backend.upload(0, geom)

    backend.upload(0, { ...geom, colors: new Uint32Array([0x0000ff80]) })

    expect(uploads).toHaveBeenCalledTimes(2)
    // The same packed ArrayBuffer, patched in its colour lane — which is what
    // says the interleave did not run a second time.
    expect(uploads.mock.calls[1]![2]).toBe(uploads.mock.calls[0]![2])
    const stored = hal.getBuffer(0, 'line')!
    expect(new Uint32Array(stored.data)[F_U32.color]).toBe(0x0000ff80)
    expect(new Float32Array(stored.data)[F_F32.x1]).toBe(100)
    expect(new Float32Array(stored.data)[F_F32.y1]).toBe(200)
  })

  test('new geometry arrays repack rather than patch', () => {
    const hal = new MockHal(PASSES)
    const backend = new GpuMarkBackend(hal, DOTPLOT_MARKS)
    backend.upload(0, makeGeometry())

    backend.upload(0, makeGeometry({ x1: new Float64Array([700]) }))

    expect(new Float32Array(hal.getBuffer(0, 'line')!.data)[F_F32.x1]).toBe(700)
  })
})

function recordingCtx() {
  const strokes: string[] = []
  const ctx = {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(() => {
      strokes.push(ctx.strokeStyle)
    }),
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
  }
  return { ctx, strokes }
}

function paint(
  regions: ReadonlyMap<number, DotplotGeometryData>,
  state = makeState(),
) {
  const { ctx, strokes } = recordingCtx()
  paintMarkBlocks(
    ctx as unknown as MarkContext2D,
    DOTPLOT_MARKS,
    regions,
    canvasWideBlocks(regions.keys(), state.canvasWidth),
    state,
  )
  return { ctx, strokes }
}

describe('the dotplot painter', () => {
  // Segments are counted by lineTo, not by stroke: same-color runs are batched
  // into one path, so stroke count tracks color runs while every segment still
  // gets drawn.
  test('draws every segment of every display, batching colour runs', () => {
    const { ctx, strokes } = paint(
      new Map([
        [0, makeSegments(3)],
        [1, makeSegments(2)],
      ]),
    )
    expect(ctx.lineTo).toHaveBeenCalledTimes(5)
    // A batch never spans two displays, so each single-color track is one stroke
    expect(strokes).toHaveLength(2)
  })

  test('flushes the path on a colour change', () => {
    const colors = new Uint32Array([
      0xff0000ff, 0xff0000ff, 0xff0000ff, 0xff00ff00, 0xff00ff00,
    ])
    const { ctx, strokes } = paint(new Map([[0, makeSegments(5, colors)]]))
    expect(ctx.lineTo).toHaveBeenCalledTimes(5)
    expect(strokes).toHaveLength(2)
  })

  test('draws nothing for a geometry with no segments', () => {
    const { strokes } = paint(new Map([[0, makeSegments(0)]]))
    expect(strokes).toHaveLength(0)
  })

  test('applies view bp and bpPerPxInv to coordinates', () => {
    // cumBp=100 for x1, cumBp=200 for y1.
    // bpPerPxHInv=2, viewBpH=5: sx1 = (100 - 5) * 2 = 190.
    // bpPerPxVInv=3, viewBpV=20/3: sy1 = 600 - (200 - 20/3) * 3 = 20.
    const { ctx } = paint(
      new Map([[0, makeGeometry()]]),
      makeState({
        viewBpH: 5,
        viewBpV: 20 / 3,
        bpPerPxHInv: 2,
        bpPerPxVInv: 3,
        lineWidth: 1,
      }),
    )
    expect(ctx.moveTo).toHaveBeenCalledWith(190, 20)
  })

  test('sets strokeStyle from the packed colour', () => {
    const { strokes } = paint(
      new Map([[0, makeGeometry({ colors: new Uint32Array([0xccbf4080]) })]]),
    )
    expect(strokes[0]).toMatch(/^rgba\(128,64,191,0\.8/)
  })

  // The GPU twin is `color.a * u.alpha` in dotplot.slang's fragment. SvgCanvas
  // has no globalAlpha, so it has to land in the rgba() string itself or the
  // SVG export would come out at full opacity.
  test('folds the plot-wide opacity into strokeStyle', () => {
    const { strokes } = paint(
      new Map([[0, makeGeometry({ colors: new Uint32Array([0xffbf4080]) })]]),
      makeState({ alpha: 0.25 }),
    )
    expect(strokes[0]).toBe('rgba(128,64,191,0.25)')
  })

  test('round caps, so a sub-lineWidth segment renders as a dot', () => {
    const { ctx } = paint(new Map([[0, makeGeometry()]]))
    expect(ctx.lineCap).toBe('round')
    expect(ctx.lineWidth).toBe(2)
  })
})

// The shape measures to a segment's centreline (as `point` measures to a bar's
// centre), so the sweep's bound is what turns that into containment. The
// recorder boxes a stroked edge as its extent widened by half the stroke on
// all four sides, and the point of that box furthest from the centreline is a
// corner, at `half * sqrt(2)` — which the round cap leaves empty, so this is
// containment plus exactly the caps' own slack and no more. The pick's live
// bound is wider (`lineWidth / 2 + HOVER_SLACK_PX`) and would pass a hit test
// a whole pixel out of place.
const SWEEP_LINE_WIDTH = 4
const SWEEP_MAX_DIST_SQ = 2 * (SWEEP_LINE_WIDTH / 2) ** 2 + 1e-9

const sweepFrame = { canvasWidth: 60, canvasHeight: 40 }
const sweepParams = {
  viewBpH: 0,
  viewBpV: 0,
  bpPerPxHInv: 1,
  bpPerPxVInv: 1,
  lineWidth: SWEEP_LINE_WIDTH,
  alpha: 1,
  baseH: 0,
  baseV: 0,
}

function sweepChannels(segments: [number, number, number, number][]) {
  const data = fakeDotplotInstanceData(segments.length, {
    x1: Float64Array.from(segments.map(s => s[0])),
    y1: Float64Array.from(segments.map(s => s[1])),
    x2: Float64Array.from(segments.map(s => s[2])),
    y2: Float64Array.from(segments.map(s => s[3])),
  })
  return {
    ...data,
    colors: new Uint32Array(segments.length).fill(0xff0000ff),
    count: segments.length,
  }
}

describe("every stroked segment answers its own hit, within its caps' slack", () => {
  test.each([
    ['horizontal', [[10, 10, 30, 10] as const, [35, 25, 50, 25] as const]],
    ['vertical', [[10, 10, 10, 30] as const, [40, 12, 40, 28] as const]],
  ])('%s', (_label, segments) => {
    const channels = sweepChannels(
      segments.map(s => [...s] as [number, number, number, number]),
    )
    // `reversed` is meaningless to a dotplot — a segment's px come from the
    // payload's absolute cumBp, never the block's bp span — so sweeping both
    // is what says the shape reads none of it.
    for (const reversed of [false, true]) {
      expect(
        sweepDrawAgainstHit(
          segmentMark,
          channels,
          {
            ...canvasWideBlocks([0], sweepFrame.canvasWidth)[0]!,
            reversed,
          },
          sweepFrame,
          sweepParams,
          { maxDistSq: SWEEP_MAX_DIST_SQ },
        ),
      ).toEqual([])
    }
  })
})
