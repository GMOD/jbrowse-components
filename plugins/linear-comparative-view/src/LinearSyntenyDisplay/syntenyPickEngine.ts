import Flatbush from '@jbrowse/core/util/flatbush'

import { KIND_BASE_TILE } from './shaders/syntenyTypes.generated.ts'
import {
  buildFeaturePath,
  computeTransform,
  isInstanceInvisible,
  isRibbonCulled,
  makeCornerScratch,
  projectSpanCorners,
  ribbonMaxPerpWidth,
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

// The 2D context the pick path evaluates `isPointInPath` in. 1x1 and offscreen:
// the path is rebuilt per candidate and never composited, so size doesn't
// matter. Lazily created by each backend on its first pick.
//
// **It must never be a context that draws.** `isPointInPath` takes its point in
// the canvas coordinate space *unaffected by the current transformation*, while
// the path it tests against was transformed as it was built — so on a context
// carrying `setTransform(dpr, …)` the two land in different spaces and the pick
// is off by the device pixel ratio. `Canvas2DSyntenyRenderer` used to pass its
// render context, where that made hover and click miss by 2x on every retina
// screen (and answer a ribbon at half the cursor's x, in the top half of the
// band, when they hit at all). A context of our own is transform-free by
// construction, which is why this returns one rather than resetting the
// caller's.
export function makePickCtx(): PickCanvasLike | undefined {
  if (typeof OffscreenCanvas !== 'undefined') {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')
    if (ctx) {
      return ctx
    }
  }
  if (typeof document !== 'undefined') {
    return document.createElement('canvas').getContext('2d') ?? undefined
  }
  return undefined
}

// Lazily-built horizontal-extent index over one region's PICKABLE instances.
// Boxes hold only the instance hull; the per-instance predicates that depend on
// the live pan or on view state (min length, alpha, viewport cull) are evaluated
// on the candidates a query returns. `panPx0`/`panPx1` record the pan the boxes
// were projected at, so a later pan is answered by shifting the query rather
// than rebuilding.
//
// `flatbush` is undefined when the region has nothing pickable at this zoom —
// the common whole-genome case, and not a state Flatbush itself can represent
// (it rejects a zero-item tree).
export interface PickIndex {
  flatbush: Flatbush | undefined
  // Flatbush position -> the entry's first and last instance, an INSTANCE SPAN
  // in the sense projectSpanCorners takes: `entryStart[p] === entryEnd[p]` for
  // one instance, and a wider pair for a tiled feature's synthetic body. Not
  // the identity, because unpickable instances are skipped rather than
  // inserted, and bodies are inserted alongside them (see buildPickIndex).
  entryStart: Int32Array
  entryEnd: Int32Array
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
// interval grows by the skew, so candidates grow with it, and the widened query
// is paid PER MOUSEMOVE where the rebuild it avoids is paid once.
//
// Re-measured 2026-08-14 in Chrome (300k instances, 1400px, viewport mid-genome;
// the earlier figures here predated excluding unpickable instances and no longer
// described either side). What the skew costs depends entirely on hull width, so
// it has to be read off the COLLINEAR arm — two related genomes, narrow hulls —
// which is the shape where widening genuinely admits new candidates:
//
//   skew    250px ->    287 candidates, <0.1ms/query
//   skew   1000px ->   1052 candidates,  0.1ms/query
//   skew   5000px ->   5084 candidates,  0.3ms/query
//   skew  20000px ->  20250 candidates,  1.2ms/query
//   rebuild                             ~33ms, once
//
// Growth is ~1 candidate per px of skew (instance density along x), NOT the
// order-of-magnitude jump the old note described. Against a ~33ms rebuild, 250px
// was orders of magnitude too tight. 2000px holds the worst query at ~0.1ms —
// about 330 hovers before the rebuild would have been the cheaper trade — while
// making ordinary single-axis panning free. Deliberately conservative: 20000px
// would still amortize over ~28 hovers.
//
// The wide-hull (all-vs-all) arm cannot inform this number, because there the
// skew is not what costs: nearly every hull spans the canvas, so a stab returns
// ~71k candidates AT ZERO SKEW and 500,000px of skew only takes it to ~108k.
// That case is slow for a reason this cap cannot fix — see
// agent-docs/reference/SYNTENY_PICKING.md.
const MAX_PAN_SKEW_PX = 2000

// Boxes are projected at the build-time pan and reused across later pans (the
// query shifts instead — see pickFeatureAtPoint). This used to rebuild on ANY
// pan, because the cached transform included the per-axis view offsets: ~25ms at
// 100k instances and ~90-120ms at 500k, landing as a main-thread stall on the
// first mousemove after every scroll.
//
// The y extent is a constant [0, 1] because a ribbon always spans its whole
// track height: the index is a 1D interval index, and queries stab y = 0.5. That
// keeps track height out of the invalidation key too.
//
// UNPICKABLE INSTANCES ARE NEVER INSERTED, which is the whole reason this scales.
// A ribbon is pickable only where it is drawn as a solid fill, i.e. where
// `ribbonMaxPerpWidth(c, height, drawCurves) >= 1`; that is
// `max(|sx2-sx1|, |sx4-sx3|) >= perpFactor`, and `perpFactor = sqrt(1+slope²)`
// is at least 1 (and exactly 1 in curve mode, where the widest point is an end),
// so `max(|sx2-sx1|, |sx4-sx3|) < 1` px rules an instance out outright in either
// mode — which is what keeps the draw mode out of the invalidation key. Two
// properties make it a build-time question rather than a per-candidate one:
//
//   - the PAN CANCELS. `sx2 - sx1 = (bp2 - bp1) * bpPerPxInv0` exactly (both
//     corners carry the same `panPx0`), and likewise for the bottom edge, so
//     this measure is a function of the two SCALES alone — precisely what
//     `isIndexUsable` already pins, and nothing a pan has to rebuild for.
//   - track HEIGHT drops out, because the bound uses only `perpFactor >= 1`
//     rather than its value, so height stays out of the invalidation key the
//     way the constant y extent above keeps it out.
//
// It is a NECESSARY condition, not the full test, so the loop still evaluates
// `ribbonMaxPerpWidth` exactly on what survives — this can only remove instances
// the query was going to reject anyway. What it removes is most of them: at
// whole-genome zoom nearly every ribbon is sub-pixel, which is also where the
// tree is largest and where a distant-mate ribbon's x-hull spans the whole
// canvas, so a POINT stab was returning ~150k candidates of which none could
// ever be picked. Measured on a synthetic 300k-instance whole-genome pairing:
// index build 472ms -> 67ms, and a warm hover 192ms -> under 0.01ms. Markers fall
// out here for free (both their edges are single points, so both deltas are 0),
// which is why the query needs no marker arm of `isRibbonCulled`.
//
// SYNTHETIC FEATURE BODIES. A tiled feature — transparent-indels mode, where
// `buildSyntenyGeometry` replaces the full-span KIND_BASE quad with one
// KIND_BASE_TILE per CIGAR match segment — has no instance covering it, so
// everything above would be asked of the tiles alone. Two ways that loses the
// feature, and colored-indel mode has neither because every feature there keeps
// its full-span quad under the indel wedges:
//
//   - the see-through indels BETWEEN tiles answer no hover at all, and at a few
//     px per indel the cursor spends much of the ribbon inside one.
//   - a tile is judged for pickability ON ITS OWN, while what is DRAWN is the
//     tiles overlapping into one ribbon — that overlap is exactly what
//     `thinWidthFade` fades each tile by. So a feature painted as a solid band
//     answered a hover only where a single tile happened to clear a pixel, and
//     a sheared ribbon has none that do.
//
// So a run of tiles carrying one feature also enters the index as ONE entry
// spanning the run — the first tile's start edge joined to the last tile's end
// edge, which is the quad the mode dropped, clipped to the tiles that were
// emitted. Nothing draws it; it exists to be picked. Derived here rather than
// emitted by the worker so that "pickable" needs no new instance kind for the
// two shaders and three draw paths to learn to skip.
//
// Inserted immediately BEFORE its own first tile, which keeps position order
// equal to DRAW order: a body loses to its own tiles and to every feature drawn
// after it, exactly where its KIND_BASE quad sat. A feature's instances are
// contiguous (buildSyntenyGeometry emits in one pass per feature) — the same
// property `syntenyPickDrawOrder.test.ts` pins — so a run is found by looking
// ahead from its first tile.
//
// `syntenyTiledPick.test.ts` states the whole of this as one requirement: sweep
// a hover across a feature in both cigar modes and get the same answer at every
// position, because which mode shades indels is not a question about what is
// hoverable. agent-docs/reference/SYNTENY_PICKING.md carries the rest.
function buildPickIndex(
  data: SyntenyInstanceData,
  t: ComputedTransform,
): PickIndex {
  const { bp1, bp2, bp3, bp4, kinds, instanceFeatureIdx, instanceCount } = data
  const { bpPerPxInv0, bpPerPxInv1 } = t

  // The last tile of the run `i` starts, or `i` itself when `i` is not a tile
  // or its feature has only this one. A run of one is not a body: its span IS
  // the tile, already in the index on its own account.
  function runEnd(i: number) {
    let last = i
    if (kinds[i] === KIND_BASE_TILE) {
      const feat = instanceFeatureIdx[i]
      while (
        last + 1 < instanceCount &&
        kinds[last + 1] === KIND_BASE_TILE &&
        instanceFeatureIdx[last + 1] === feat
      ) {
        last++
      }
    }
    return last
  }

  function startsRun(i: number) {
    return (
      kinds[i] === KIND_BASE_TILE &&
      (i === 0 ||
        kinds[i - 1] !== KIND_BASE_TILE ||
        instanceFeatureIdx[i - 1] !== instanceFeatureIdx[i])
    )
  }

  // Counted first, so the two staging lanes below are sized exactly rather than
  // by a doubling guess. It is one scan of `kinds`, and in colored-indel
  // geometry — where there are no tiles at all — it finds nothing.
  let bodyCount = 0
  for (let i = 0; i < instanceCount; i++) {
    if (startsRun(i) && runEnd(i) > i) {
      bodyCount++
    }
  }

  // One pass to select, then one over the selection to project. The selection
  // pass reads bp deltas rather than projected corners, so it is cheaper than
  // the single projection pass it replaces, and the projection then runs only on
  // what is kept. The width test is the span's, so a body is admitted on the
  // whole feature's width where its tiles are each judged on their own.
  const startAll = new Int32Array(instanceCount + bodyCount)
  const endAll = new Int32Array(instanceCount + bodyCount)
  let kept = 0
  function keep(first: number, last: number) {
    const wTop = Math.abs(bp2[last]! - bp1[first]!) * bpPerPxInv0
    const wBot = Math.abs(bp4[first]! - bp3[last]!) * bpPerPxInv1
    if (wTop >= 1 || wBot >= 1) {
      startAll[kept] = first
      endAll[kept] = last
      kept++
    }
  }
  for (let i = 0; i < instanceCount; i++) {
    if (startsRun(i)) {
      const last = runEnd(i)
      if (last > i) {
        keep(i, last)
      }
    }
    keep(i, i)
  }
  // `slice`, not `subarray`: a view keeps the whole instanceCount-long buffer
  // alive behind it, and the index outlives this call — 2 MB retained per region
  // at 500k instances, worst exactly where `kept` is smallest. At whole-genome
  // zoom `kept` is 0 and the retained buffer was the entire cost of the entry.
  // One copy against a rebuild already measured in tens of ms.
  //
  // With no bodies the end lane IS the start lane, because every entry is then
  // one instance and `entryEnd[p] === entryStart[p]` for all of them. That is
  // every colored-indel region, i.e. the default, and it is what keeps this
  // costing the same as the single lane it replaced there.
  const entryStart = startAll.slice(0, kept)
  const entryEnd = bodyCount === 0 ? entryStart : endAll.slice(0, kept)
  if (kept === 0) {
    return {
      flatbush: undefined,
      entryStart,
      entryEnd,
      bpPerPxInv0,
      bpPerPxInv1,
      panPx0: t.panPx0,
      panPx1: t.panPx1,
    }
  }
  const flatbush = new Flatbush(kept)
  const scratch = makeCornerScratch()
  for (let k = 0; k < kept; k++) {
    const c = projectSpanCorners(data, entryStart[k]!, entryEnd[k]!, t, scratch)
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
    entryStart,
    entryEnd,
    bpPerPxInv0,
    bpPerPxInv1,
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
    const { yTop, height, minAlignmentLength, alpha } = params
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
    // Nothing in this region is wide enough to be pickable at this zoom. Cached
    // as such, so a hover over a whole-genome hairball answers without touching
    // the geometry again.
    if (!idx.flatbush) {
      continue
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
    // Walked from the highest position down, so the topmost (last drawn) wins.
    // Sorted as an Int32Array — the native numeric sort has no per-comparison
    // call into JS the way `(a, b) => b - a` on the plain array `search` returns
    // does. Ascending then walked backwards, so nothing has to be reversed.
    //
    // Sorting POSITIONS and resolving each to its instances inside the loop is
    // the same order: the entry lanes are filled by an ascending scan, so
    // position order IS draw order — including each synthetic feature body,
    // which is inserted at the position its full-span quad would have drawn at.
    const candidates = new Int32Array(
      idx.flatbush.search(x - panHi, 0.5, x - panLo, 0.5),
    ).sort()
    const { entryStart, entryEnd } = idx
    for (let ci = candidates.length - 1; ci >= 0; ci--) {
      const pos = candidates[ci]!
      // Every per-feature question is asked of the entry's first instance: a
      // body's tiles all carry their feature's length and its base color, which
      // is the same pair the dropped full-span quad carried.
      const i = entryStart[pos]!
      if (data.alignmentLengths[i]! < minAlignmentLength) {
        continue
      }
      if (isInstanceInvisible(data.colors[i]!, alpha)) {
        continue
      }

      const c = projectSpanCorners(data, i, entryEnd[pos]!, transform, scratch)
      if (isRibbonCulled(c, canvasLogicalWidth, state.overdrawPx)) {
        continue
      }
      // The other half of the fill/stroke split in
      // Canvas2DSyntenyRenderer.drawSyntenyTrack — not a copy of it: both call
      // the same `ribbonMaxPerpWidth`, and `syntenyPickRenderAgreement.test.ts`
      // pins the one thing that could still drift, this threshold. `drawCurves`
      // has to be threaded through with it: a bezier ribbon is at its widest
      // where its edges are vertical, so the two modes do not answer alike.
      //
      // A ribbon thinner than 1px
      // perpendicular is drawn as a 1px centerline (or faded on the GPU), not a
      // solid fill — its silhouette polygon is a sub-pixel sliver that
      // isPointInPath can't reliably hit, so it's a non-pickable line. Ribbons
      // drawn as solid fills are exactly the ones that stay pickable. Evaluated
      // per candidate rather than at index-build time because both the cull and
      // the perpendicular width depend on the live pan.
      //
      // A synthetic feature body is measured on the whole run, which is what
      // makes it the exception that keeps the rule: the tiles it spans are each
      // drawn as a faded 1px stroke, and it is their OVERLAP that is the solid
      // band on screen. Answering per tile is what left a visibly solid ribbon
      // unhoverable.
      if (ribbonMaxPerpWidth(c, height, params.drawCurves) < 1) {
        continue
      }

      // Path built in track-local space (yTop=0) to match localY below.
      buildFeaturePath(ctx, c, 0, height, params.drawCurves)
      if (ctx.isPointInPath(x, localY)) {
        return { key, instanceIndex: i }
      }
    }
  }
  return undefined
}
