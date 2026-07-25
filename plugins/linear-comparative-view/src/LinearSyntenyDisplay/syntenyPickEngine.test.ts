import { pickFeatureAtPoint } from './syntenyPickEngine.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PickCanvasLike, PickIndex } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'

// Real point-in-polygon so positional assertions mean something — a mock that
// always returns true would make every "hits here, misses there" test vacuous.
function pointInPolygon(x: number, y: number, pts: [number, number][]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!
    const [xj, yj] = pts[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function createPickCtx(): PickCanvasLike {
  let pts: [number, number][] = []
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath() {
      pts = []
    },
    closePath() {},
    moveTo(x: number, y: number) {
      pts.push([x, y])
    },
    lineTo(x: number, y: number) {
      pts.push([x, y])
    },
    // Only the endpoint matters here; the positional tests all use straight mode.
    bezierCurveTo(
      _cp1x: number,
      _cp1y: number,
      _cp2x: number,
      _cp2y: number,
      x: number,
      y: number,
    ) {
      pts.push([x, y])
    },
    fill() {},
    stroke() {},
    isPointInPath(x: number, y: number) {
      return pointInPolygon(x, y, pts)
    },
  }
}

// One 100px-wide rectangular ribbon: top edge spans x=[100,200] on axis 0,
// bottom edge the same on axis 1, at bpPerPx=1 with no pan. Corner order
// follows buildFeaturePath: sx1/sx2 top, sx4/sx3 bottom.
function makeData(
  overrides?: Partial<SyntenyInstanceData>,
): SyntenyInstanceData {
  return {
    bp1: Float32Array.from([100]),
    bp2: Float32Array.from([200]),
    bp3: Float32Array.from([200]),
    bp4: Float32Array.from([100]),
    base0: 0,
    base1: 0,
    colors: new Uint32Array([0xff808080]),
    kinds: new Uint8Array([0]),
    instanceFeatureIdx: new Uint32Array([0]),
    alignmentLengths: new Float32Array([10000]),
    instanceCount: 1,
    ...overrides,
  }
}

function makeParams(
  overrides?: Partial<SyntenyTrackRenderParams>,
): SyntenyTrackRenderParams {
  return {
    yTop: 0,
    height: 100,
    alpha: 1,
    fadeThinAlignments: true,
    minAlignmentLength: 0,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    offsetPx0: 0,
    offsetPx1: 0,
    bpPerPx0: 1,
    bpPerPx1: 1,
    drawCurves: false,
    ...overrides,
  }
}

function pickAt(
  x: number,
  y: number,
  params: SyntenyTrackRenderParams,
  pickIndices: Map<number, PickIndex>,
  data = makeData(),
) {
  const state: SyntenyRenderState = {
    overdrawPx: 300,
    perTrack: new Map([[0, params]]),
  }
  return pickFeatureAtPoint({
    ctx: createPickCtx(),
    state,
    regions: new Map([[0, data]]),
    pickIndices,
    canvasLogicalWidth: 800,
    x,
    y,
  })
}

describe('pick index reuse', () => {
  test('a pan reuses the index instead of rebuilding it', () => {
    const pickIndices = new Map<number, PickIndex>()
    pickAt(150, 50, makeParams(), pickIndices)
    const first = pickIndices.get(0)
    expect(first).toBeDefined()

    pickAt(100, 50, makeParams({ offsetPx0: 50, offsetPx1: 50 }), pickIndices)
    expect(pickIndices.get(0)).toBe(first)
  })

  test('a one-sided pan within the skew cap still reuses the index', () => {
    const pickIndices = new Map<number, PickIndex>()
    pickAt(150, 50, makeParams(), pickIndices)
    const first = pickIndices.get(0)

    pickAt(150, 50, makeParams({ offsetPx0: 100 }), pickIndices)
    expect(pickIndices.get(0)).toBe(first)
  })

  test('a one-sided pan past the skew cap rebuilds the index', () => {
    const pickIndices = new Map<number, PickIndex>()
    pickAt(150, 50, makeParams(), pickIndices)
    const first = pickIndices.get(0)

    // 400px of skew between the axes exceeds MAX_PAN_SKEW_PX, past which the
    // widened query would return too many candidates to reject cheaply
    pickAt(150, 50, makeParams({ offsetPx0: 400 }), pickIndices)
    expect(pickIndices.get(0)).not.toBe(first)
  })

  test('a zoom rebuilds the index', () => {
    const pickIndices = new Map<number, PickIndex>()
    pickAt(150, 50, makeParams(), pickIndices)
    const first = pickIndices.get(0)

    pickAt(150, 50, makeParams({ bpPerPx0: 2 }), pickIndices)
    expect(pickIndices.get(0)).not.toBe(first)
  })
})

describe('pick after panning', () => {
  test('hit follows the ribbon when both views pan together', () => {
    const pickIndices = new Map<number, PickIndex>()
    // unpanned: the ribbon covers x=[100,200]
    expect(pickAt(150, 50, makeParams(), pickIndices)).toEqual({
      key: 0,
      featureIndex: 0,
    })

    // panning right by 50px moves it to x=[50,150] — the same index must now
    // answer for the new screen positions, not the old ones
    const panned = makeParams({ offsetPx0: 50, offsetPx1: 50 })
    expect(pickAt(100, 50, panned, pickIndices)).toEqual({
      key: 0,
      featureIndex: 0,
    })
    expect(pickAt(190, 50, panned, pickIndices)).toBeUndefined()
  })

  test('hit is exact when the two views pan by different amounts', () => {
    const pickIndices = new Map<number, PickIndex>()
    pickAt(150, 50, makeParams(), pickIndices)

    // top edge shifts to [50,150], bottom edge stays [100,200]: a slanted
    // ribbon, the case where the query interval has to widen by |pan0 - pan1|
    const skewed = makeParams({ offsetPx0: 50, offsetPx1: 0 })
    expect(pickAt(75, 2, skewed, pickIndices)).toEqual({
      key: 0,
      featureIndex: 0,
    })
    expect(pickAt(190, 98, skewed, pickIndices)).toEqual({
      key: 0,
      featureIndex: 0,
    })
    // near the top the ribbon has already moved left, so the bottom-edge x
    // must not register a hit there
    expect(pickAt(190, 2, skewed, pickIndices)).toBeUndefined()
    expect(pickAt(75, 98, skewed, pickIndices)).toBeUndefined()
  })
})

describe('per-candidate rejection', () => {
  test('an instance with one edge outside the draw limits is not pickable', () => {
    // Top edge sits far off-screen left (beyond -overdrawPx) while the bottom
    // edge is on screen. The renderer culls the whole instance, so picking must
    // agree even though the instance hull still covers the query point.
    const data = makeData({
      bp1: Float32Array.from([-5000]),
      bp2: Float32Array.from([-4900]),
    })
    expect(
      pickAt(150, 50, makeParams(), new Map<number, PickIndex>(), data),
    ).toBeUndefined()
  })

  test('a sub-pixel-thin ribbon is not pickable after a pan skews it', () => {
    // 0.5px wide on both axes: drawn as a 1px centerline stroke, never a fill.
    const data = makeData({
      bp1: Float32Array.from([100]),
      bp2: Float32Array.from([100.5]),
      bp3: Float32Array.from([100.5]),
      bp4: Float32Array.from([100]),
    })
    const pickIndices = new Map<number, PickIndex>()
    expect(pickAt(100, 50, makeParams(), pickIndices, data)).toBeUndefined()
    expect(
      pickAt(
        100,
        50,
        makeParams({ offsetPx0: 20, offsetPx1: 0 }),
        pickIndices,
        data,
      ),
    ).toBeUndefined()
  })
})
