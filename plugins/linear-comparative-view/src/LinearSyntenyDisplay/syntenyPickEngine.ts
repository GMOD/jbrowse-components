import Flatbush from '@jbrowse/core/util/flatbush'

import {
  buildFeaturePath,
  computeTransform,
  isInstanceInvisible,
  isRibbonCulled,
  makeCornerScratch,
  projectCorners,
  ribbonPerpWidth,
} from './syntenyRibbonPath.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type {
  SyntenyPickResult,
  SyntenyRenderState,
} from './syntenyRenderingBackendTypes.ts'
import type { CanvasLike, ComputedTransform } from './syntenyRibbonPath.ts'

export interface PickCanvasLike extends CanvasLike {
  isPointInPath(x: number, y: number): boolean
}

// Lazily-built horizontal-extent index over one region's instances. Boxes hold
// only the instance hull; every per-instance predicate (min length, alpha,
// viewport cull, sub-pixel pickability) is evaluated on the few candidates a
// query returns. `panPx0`/`panPx1` record the pan the boxes were projected at,
// so a later pan is answered by shifting the query rather than rebuilding.
export interface PickIndex {
  flatbush: Flatbush
  bpPerPxInv0: number
  bpPerPxInv1: number
  panPx0: number
  panPx1: number
}

// How far the two views may drift APART (px) before the index is rebuilt. A pan
// that moves both views equally never widens the query at all, so this only
// trips when one view is panned on its own.
//
// The ceiling exists because the widening is what a stale index costs: the query
// interval grows by the skew, and on a dense whole-genome view candidate counts
// grow with it — measured at 500k instances, a 100px skew returns ~10k
// candidates (0.5ms/query) while 2000px returns ~125k (6ms/query, which would
// read as sluggish hover). Rebuilding instead costs ~90ms once. 250px keeps the
// worst query near 1ms while still making the common case free.
const MAX_PAN_SKEW_PX = 250

// Boxes are projected at the build-time pan and reused across later pans (the
// query shifts instead — see pickFeatureAtPoint). This used to rebuild on ANY
// pan, because the cached transform included the per-axis view offsets: ~25ms at
// 100k instances and ~90-120ms at 500k, landing as a main-thread stall on the
// first mousemove after every scroll.
//
// The y extent is a constant [0, 1] because a ribbon always spans its whole
// track height: the index is a 1D interval index, and queries stab y = 0.5. That
// keeps track height out of the invalidation key too.
function buildPickIndex(
  data: SyntenyInstanceData,
  t: ComputedTransform,
): PickIndex {
  const flatbush = new Flatbush(data.instanceCount)
  const scratch = makeCornerScratch()
  for (let i = 0; i < data.instanceCount; i++) {
    const c = projectCorners(data, i, t, scratch)
    flatbush.add(
      Math.min(c.sx1, c.sx2, c.sx3, c.sx4),
      0,
      Math.max(c.sx1, c.sx2, c.sx3, c.sx4),
      1,
    )
  }
  flatbush.finish()
  return {
    flatbush,
    bpPerPxInv0: t.bpPerPxInv0,
    bpPerPxInv1: t.bpPerPxInv1,
    panPx0: t.panPx0,
    panPx1: t.panPx1,
  }
}

// Reusable when the zoom is unchanged and the two views have not drifted too far
// apart since the boxes were projected.
function isIndexUsable(idx: PickIndex, t: ComputedTransform) {
  return (
    idx.bpPerPxInv0 === t.bpPerPxInv0 &&
    idx.bpPerPxInv1 === t.bpPerPxInv1 &&
    Math.abs(t.panPx0 - idx.panPx0 - (t.panPx1 - idx.panPx1)) <= MAX_PAN_SKEW_PX
  )
}

export interface PickContext {
  ctx: PickCanvasLike
  state: SyntenyRenderState
  regions: Map<number, SyntenyInstanceData>
  pickIndices: Map<number, PickIndex>
  canvasLogicalWidth: number
  x: number
  y: number
}

export function pickFeatureAtPoint(
  pc: PickContext,
): SyntenyPickResult | undefined {
  const { ctx, state, regions, pickIndices, canvasLogicalWidth, x, y } = pc
  const scratch = makeCornerScratch()

  // Iterate tracks in reverse draw order so top-most wins.
  const entries = [...state.perTrack]
  for (let ei = entries.length - 1; ei >= 0; ei--) {
    const [key, params] = entries[ei]!
    const data = regions.get(key)
    if (!data || data.instanceCount === 0) {
      continue
    }
    const { yTop, height, minAlignmentLength } = params
    if (y < yTop || y > yTop + height) {
      continue
    }
    const localY = y - yTop
    const transform = computeTransform(params, data)

    let idx = pickIndices.get(key)
    if (!idx || !isIndexUsable(idx, transform)) {
      idx = buildPickIndex(data, transform)
      pickIndices.set(key, idx)
    }

    // Panning by (d0, d1) since the boxes were projected moves an instance's top
    // corners by d0 and its bottom corners by d1, so its true hull satisfies
    // `trueMin >= storedMin + min(d)` and `trueMax <= storedMax + max(d)`.
    // Stabbing the interval below is therefore a conservative superset of the
    // instances covering x: a POINT stab (as precise as a freshly built index)
    // whenever both views moved together, widening only by the skew, which
    // isIndexUsable caps. Every candidate is re-projected with the live transform
    // and tested exactly below, so widening only costs extra rejects.
    const d0 = transform.panPx0 - idx.panPx0
    const d1 = transform.panPx1 - idx.panPx1
    const panLo = Math.min(d0, d1)
    const panHi = Math.max(d0, d1)
    // Walked from the highest instance index down, so the topmost (last drawn)
    // wins. Sorted as an Int32Array — on a dense whole-genome view a stab can
    // return ~100k candidates, and the native numeric sort has no per-comparison
    // call into JS the way `(a, b) => b - a` on the plain array `search` returns
    // does. Ascending then walked backwards, so nothing has to be reversed.
    const candidates = new Int32Array(
      idx.flatbush.search(x - panHi, 0.5, x - panLo, 0.5),
    ).sort()
    for (let ci = candidates.length - 1; ci >= 0; ci--) {
      const i = candidates[ci]!
      if (data.alignmentLengths[i]! < minAlignmentLength) {
        continue
      }
      if (isInstanceInvisible(data.colors[i]!)) {
        continue
      }

      const c = projectCorners(data, i, transform, scratch)
      if (isRibbonCulled(c, canvasLogicalWidth, state.overdrawPx)) {
        continue
      }
      // SYNC: mirrors the perpW<1 fill/stroke split in
      // Canvas2DSyntenyRenderer.drawSyntenyTrack. A ribbon thinner than 1px
      // perpendicular is drawn as a 1px centerline (or faded on the GPU), not a
      // solid fill — its silhouette polygon is a sub-pixel sliver that
      // isPointInPath can't reliably hit, so it's a non-pickable line. Ribbons
      // drawn as solid fills are exactly the ones that stay pickable. Evaluated
      // per candidate rather than at index-build time because both the cull and
      // the perpendicular width depend on the live pan.
      if (ribbonPerpWidth(c, height) < 1) {
        continue
      }

      // Path built in track-local space (yTop=0) to match localY below.
      buildFeaturePath(ctx, c, 0, height, params.drawCurves)
      if (ctx.isPointInPath(x, localY)) {
        return { key, featureIndex: i }
      }
    }
  }
  return undefined
}
