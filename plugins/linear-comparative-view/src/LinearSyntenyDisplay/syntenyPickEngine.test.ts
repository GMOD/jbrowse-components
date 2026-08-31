import { pickFeatureAtPoint } from './syntenyPickEngine.ts'
import {
  buildFeaturePath,
  computeTransform,
  isInstanceInvisible,
  isRibbonCulled,
  makeCornerScratch,
  projectCorners,
  ribbonMaxPerpWidth,
} from './syntenyRibbonPath.ts'
import { createGeometricPickCtx } from './testUtils.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PickIndex } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'

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
    groundColor: '#fff',
    perTrack: new Map([[0, params]]),
  }
  return pickFeatureAtPoint({
    ctx: createGeometricPickCtx(),
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

    // 3000px of skew between the axes exceeds MAX_PAN_SKEW_PX, past which the
    // widened query would return too many candidates to reject cheaply. The
    // threshold is a measured balance point rather than a round number — see
    // agent-docs/reference/SYNTENY_PICKING.md — so this only pins that SOME
    // skew rebuilds, not where the line sits.
    pickAt(150, 50, makeParams({ offsetPx0: 3000 }), pickIndices)
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
      instanceIndex: 0,
    })

    // panning right by 50px moves it to x=[50,150] — the same index must now
    // answer for the new screen positions, not the old ones
    const panned = makeParams({ offsetPx0: 50, offsetPx1: 50 })
    expect(pickAt(100, 50, panned, pickIndices)).toEqual({
      key: 0,
      instanceIndex: 0,
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
      instanceIndex: 0,
    })
    expect(pickAt(190, 98, skewed, pickIndices)).toEqual({
      key: 0,
      instanceIndex: 0,
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

// The index does not hold every instance: `buildPickIndex` leaves out the ones
// whose horizontal width is under 1px on BOTH axes, because `perpFactor >= 1`
// makes that sufficient to rule out `ribbonMaxPerpWidth >= 1` in either draw
// mode, and because the pan
// cancels out of that measure so it is settled by the two scales the index is
// already keyed on. That is a real narrowing of what a stab can return, so it
// wants a test that is not about one hand-placed ribbon: a selection predicate
// which is merely *nearly* necessary would keep passing every positional test
// above and silently drop pickable ribbons in some corner of the parameter
// space.
//
// So this drives the real engine against a brute-force scan that applies the
// same predicates, in the same order, over EVERY instance with no index at all,
// and demands the identical verdict everywhere. Deliberately not a restatement
// of the width bound — it never mentions it, so it cannot agree with a wrong
// one.
function bruteForcePick(
  data: SyntenyInstanceData,
  params: SyntenyTrackRenderParams,
  overdrawPx: number,
  canvasLogicalWidth: number,
  x: number,
  y: number,
) {
  const { height, minAlignmentLength, alpha } = params
  if (y < params.yTop || y > params.yTop + height) {
    return undefined
  }
  const t = computeTransform(params, data)
  const scratch = makeCornerScratch()
  const ctx = createGeometricPickCtx()
  // Descending, so the topmost (last drawn) wins — the order the engine walks.
  for (let i = data.instanceCount - 1; i >= 0; i--) {
    if (data.alignmentLengths[i]! < minAlignmentLength) {
      continue
    }
    if (isInstanceInvisible(data.colors[i]!, alpha)) {
      continue
    }
    const c = projectCorners(data, i, t, scratch)
    if (isRibbonCulled(c, canvasLogicalWidth, overdrawPx)) {
      continue
    }
    if (ribbonMaxPerpWidth(c, height, params.drawCurves) < 1) {
      continue
    }
    buildFeaturePath(ctx, c, 0, height, params.drawCurves)
    if (ctx.isPointInPath(x, y - params.yTop)) {
      return { key: 0, instanceIndex: i }
    }
  }
  return undefined
}

// Widths deliberately straddle the 1px boundary the selection turns on, at both
// ends and on each axis independently — a ribbon 0.4px wide on top and 6px on
// the bottom is pickable and must survive the cut.
function makeMixedData(seed: number, n: number): SyntenyInstanceData {
  let s = seed
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const bp1 = new Float32Array(n)
  const bp2 = new Float32Array(n)
  const bp3 = new Float32Array(n)
  const bp4 = new Float32Array(n)
  const colors = new Uint32Array(n)
  const kinds = new Uint8Array(n)
  const alignmentLengths = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const wTop = rnd() < 0.5 ? rnd() * 1.2 : rnd() * 40
    const wBot = rnd() < 0.5 ? rnd() * 1.2 : rnd() * 40
    const q = rnd() * 800
    const t = rnd() * 800
    bp1[i] = q
    bp2[i] = q + wTop
    // reversed on some, so the corner order is not always ascending
    bp3[i] = rnd() < 0.3 ? t : t + wBot
    bp4[i] = rnd() < 0.3 ? t + wBot : t
    // a few genuinely invisible, so that predicate is exercised too
    colors[i] = rnd() < 0.1 ? 0x00808080 : 0xff808080
    kinds[i] = 0
    alignmentLengths[i] = Math.floor(rnd() * 20000)
  }
  return {
    bp1,
    bp2,
    bp3,
    bp4,
    base0: 0,
    base1: 0,
    colors,
    kinds,
    instanceFeatureIdx: Uint32Array.from({ length: n }, (_, i) => i),
    alignmentLengths,
    instanceCount: n,
  }
}

test('the index answers exactly what a brute-force scan answers', () => {
  const data = makeMixedData(7, 400)
  // Zooms either side of 1 (so the same bp deltas land on both sides of the 1px
  // cut), one-sided pans within and past the skew cap, a min-length filter, and
  // a curve pass.
  const cases: Partial<SyntenyTrackRenderParams>[] = [
    {},
    { bpPerPx0: 4, bpPerPx1: 4 },
    { bpPerPx0: 0.25, bpPerPx1: 0.25 },
    { bpPerPx0: 3, bpPerPx1: 0.5 },
    { offsetPx0: 40, offsetPx1: 0 },
    { offsetPx0: 400, offsetPx1: 0 },
    { offsetPx0: 120, offsetPx1: 120 },
    { minAlignmentLength: 12000 },
    // either side of the visibility floor, which the opacity slider reaches:
    // 0.02 leaves the packed 0xff alpha above it, 0.005 puts every ribbon under
    { alpha: 0.02 },
    { alpha: 0.005 },
    { drawCurves: true },
    { height: 7 },
  ]
  let hits = 0
  for (const override of cases) {
    const params = makeParams(override)
    // One index per case, then reused across the sweep — which is also what
    // exercises the reuse path against a moving query x.
    const pickIndices = new Map<number, PickIndex>()
    for (let x = 0; x <= 800; x += 3) {
      const y = 50 % Math.max(params.height, 1)
      const got = pickAt(x, y, params, pickIndices, data)
      const want = bruteForcePick(data, params, 300, 800, x, y)
      if (want) {
        hits++
      }
      expect({ x, got }).toEqual({ x, got: want })
    }
  }
  // Guards against passing vacuously on a sweep that never hits anything.
  expect(hits).toBeGreaterThan(200)
})
