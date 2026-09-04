import Flatbush from '@jbrowse/core/util/flatbush'
import { capsuleDistPx } from '@jbrowse/render-core/shaders/capsule'
import { CAPSULE_MIN_LEN_PX } from '@jbrowse/render-core/shaders/capsuleConsts'

import { cumBpToPxH, cumBpToPxV } from './dotplotProject.ts'

import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'

// The screen transform a pick is answered against: `DotplotView.plotTransform`
// itself, which is the same reconstruction `drawDotplotInstances` and the shader
// run on. Held as the INVERSE bpPerPx, which is the form the exact test below
// needs (cumBp -> px, the direction that has to agree with the draw); the two
// divisions that turn the cursor's px back into bp are once per pick, against a
// segment loop.
export interface DotplotPickTransform {
  viewBpH: number
  viewBpV: number
  bpPerPxHInv: number
  bpPerPxVInv: number
  viewHeight: number
}

// One box per FEATURE, in absolute cumBp, over the hull of all of that feature's
// segments. `featureIdx[boxId]` is the feature the box belongs to — a feature
// filtered out by `minAlignmentLength` emits no segments and so no box, which
// is what makes this indirection necessary rather than an identity map.
//
// Feature-level rather than segment-level, which is where this diverges from
// syntenyPickEngine's instance-level index: the answer a tooltip wants is the
// feature, a CIGAR-detailed alignment is many segments of one feature, and the
// segments of a feature are contiguous (see `featureSegmentRange`) — so the
// smaller index is also the more direct one.
export interface DotplotPickIndex {
  flatbush: Flatbush
  featureIdx: Uint32Array
}

export interface DotplotPickHit {
  // The winning SEGMENT — which of the feature's lines the cursor is nearest.
  // The one piece of hover state stored, because the feature index derives from
  // it (`instanceFeatureIdx`) and the CIGAR operator under the cursor does not
  // derive from anything else.
  segmentIdx: number
  featureIdx: number
  // px from the cursor to the nearest point of the feature, for the
  // nearest-wins comparison the view makes across displays
  distancePx: number
}

// The same hit resolved against the whole plot: which track's geometry it came
// out of. What `DotplotView.pickFeatureAt` answers and `setHoveredFeature`
// consumes — the display it names takes the index, every other display clears.
export interface DotplotPlotPickHit extends DotplotPickHit {
  displayKey: number
}

// `instanceFeatureIdx` is non-decreasing: `buildLineSegments` walks features in
// order and writes each one's segments consecutively. So a feature owns one
// contiguous run, found by bracketing it — no per-feature offsets array, and the
// same lookup serves both the pick's exact test and the hover highlight's path.
export function featureSegmentRange(
  instanceFeatureIdx: Uint32Array,
  instanceCount: number,
  featureIdx: number,
) {
  return [
    lowerBound(instanceFeatureIdx, instanceCount, featureIdx),
    lowerBound(instanceFeatureIdx, instanceCount, featureIdx + 1),
  ] as const
}

// First index in [0, n) whose value is >= target.
function lowerBound(arr: Uint32Array, n: number, target: number) {
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid]! < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

// Distinct features in `instanceFeatureIdx`, i.e. the number of boxes the index
// will hold. Counted in its own pass because Flatbush is sized up front and
// boxes have to be `add`ed straight into it — collecting them into a JS array
// first would allocate four numbers per feature on the heap, which at
// whole-genome scale is the largest thing on this path by far.
function countFeatureRuns(instanceFeatureIdx: Uint32Array, n: number) {
  let runs = 0
  let prev = -1
  for (let i = 0; i < n; i++) {
    const feature = instanceFeatureIdx[i]!
    if (feature !== prev) {
      runs++
      prev = feature
    }
  }
  return runs
}

export function buildDotplotPickIndex(
  data: DotplotInstanceData,
): DotplotPickIndex | undefined {
  const { x1, y1, x2, y2, instanceFeatureIdx, instanceCount } = data
  if (instanceCount === 0) {
    // Flatbush throws on numItems <= 0, and there is nothing to hit anyway
    return undefined
  }
  const featureIdx = new Uint32Array(
    countFeatureRuns(instanceFeatureIdx, instanceCount),
  )
  const flatbush = new Flatbush(featureIdx.length)
  let n = 0
  let i = 0
  while (i < instanceCount) {
    const feature = instanceFeatureIdx[i]!
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    // One walk of the feature's run, which the monotonic order hands us for
    // free — no grouping pass and no sort.
    while (i < instanceCount && instanceFeatureIdx[i] === feature) {
      const ax = x1[i]!
      const ay = y1[i]!
      const bx = x2[i]!
      const by = y2[i]!
      minX = Math.min(minX, ax, bx)
      maxX = Math.max(maxX, ax, bx)
      minY = Math.min(minY, ay, by)
      maxY = Math.max(maxY, ay, by)
      i++
    }
    featureIdx[n] = feature
    flatbush.add(minX, minY, maxX, maxY)
    n++
  }
  flatbush.finish()
  return { flatbush, featureIdx }
}

// Built lazily on the first pick and keyed on the coordinate array's identity —
// `buildLineSegments` replaces every coordinate array atomically, so `x1` is the
// geometry token, the same one `DOTPLOT_INSTANCE_CACHE` keys its packed bytes
// on. A WeakMap rather than display state for two reasons: nothing reactive
// should observe an index this size, and a geometry that has been replaced takes
// its index with it instead of being explicitly evicted.
//
// The index needs no pan or zoom invalidation at all, which is the whole
// difference from `syntenyPickEngine`'s `isIndexUsable`/MAX_PAN_SKEW_PX
// machinery: these boxes are in absolute cumBp, not projected px. A pan does not
// rebuild dotplot geometry (it is a uniform-only update), and a zoom rebuilds it
// — which replaces `x1` and invalidates this entry for free.
const indexCache = new WeakMap<Float64Array, DotplotPickIndex | undefined>()

function getPickIndex(data: DotplotInstanceData) {
  if (!indexCache.has(data.x1)) {
    indexCache.set(data.x1, buildDotplotPickIndex(data))
  }
  return indexCache.get(data.x1)
}

// Px distance from (px, py) to the segment (ax,ay)-(bx,by): the cursor taken
// into the segment's own frame (capsule.slang's `capsuleFrame`, with its guard
// for the zero-length dots a whole-genome plot is mostly made of) and measured
// by the shader's own capsule distance, so the pick is the ink's end caps
// included.
function pointSegmentDistPx(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  const degenerate = len <= CAPSULE_MIN_LEN_PX
  const tx = degenerate ? 1 : dx / len
  const ty = degenerate ? 0 : dy / len
  const rx = px - (ax + bx) / 2
  const ry = py - (ay + by) / 2
  return capsuleDistPx(rx * tx + ry * ty, ry * tx - rx * ty, len / 2)
}

/**
 * The feature nearest a cursor position within `tolerancePx`, or undefined.
 *
 * NEAREST wins, where `syntenyPickEngine` takes the topmost. A ribbon is an
 * opaque fill, so "which one is on top" is what the user sees and the only
 * defensible answer; a dotplot is thin lines over each other, where the nearest
 * is what the cursor is pointing at. Ties go to the later segment, which is the
 * one drawn on top.
 *
 * The exact test measures in PX, not bp. The two axes are independently scaled
 * (and routinely differ by orders of magnitude on a read-vs-ref plot), so a bp
 * distance would pick a feature far away on the compressed axis over one under
 * the cursor.
 */
export function pickDotplotFeature({
  data,
  x,
  y,
  transform,
  tolerancePx,
}: {
  data: DotplotInstanceData
  // component px, y measured downward from the top of the plot
  x: number
  y: number
  transform: DotplotPickTransform
  tolerancePx: number
}): DotplotPickHit | undefined {
  const index = getPickIndex(data)
  if (!index) {
    return undefined
  }
  const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, viewHeight } = transform
  const bpPerPxH = 1 / bpPerPxHInv
  const bpPerPxV = 1 / bpPerPxVInv
  const cursorBpH = viewBpH + x * bpPerPxH
  const cursorBpV = viewBpV + (viewHeight - y) * bpPerPxV
  // The tolerance is a px radius, so it is a different bp distance on each axis.
  const tolH = tolerancePx * bpPerPxH
  const tolV = tolerancePx * bpPerPxV
  const candidates = index.flatbush.search(
    cursorBpH - tolH,
    cursorBpV - tolV,
    cursorBpH + tolH,
    cursorBpV + tolV,
  )
  const { x1, y1, x2, y2, instanceFeatureIdx, instanceCount } = data
  let best: DotplotPickHit | undefined
  let bestDistPx = Infinity
  for (const boxId of candidates) {
    const feature = index.featureIdx[boxId]!
    const [start, end] = featureSegmentRange(
      instanceFeatureIdx,
      instanceCount,
      feature,
    )
    for (let s = start; s < end; s++) {
      // The shared reconstruction, so a hit means the cursor is within
      // tolerance of pixels `drawDotplotInstances` actually painted.
      const sx1 = cumBpToPxH(x1[s]!, viewBpH, bpPerPxHInv)
      const sy1 = cumBpToPxV(y1[s]!, viewBpV, bpPerPxVInv, viewHeight)
      const sx2 = cumBpToPxH(x2[s]!, viewBpH, bpPerPxHInv)
      const sy2 = cumBpToPxV(y2[s]!, viewBpV, bpPerPxVInv, viewHeight)
      const distPx = pointSegmentDistPx(x, y, sx1, sy1, sx2, sy2)
      // A tie goes to the later segment, the one drawn on top. `<=` alone would
      // not give that: Flatbush hands candidates back in tree order, so an
      // equidistant earlier segment can arrive last — which a whole-genome plot
      // reaches routinely, where repeats collapse to dots at identical cumBp.
      const better =
        distPx < bestDistPx ||
        (distPx === bestDistPx && s > (best?.segmentIdx ?? -1))
      if (distPx <= tolerancePx && better) {
        bestDistPx = distPx
        best = { segmentIdx: s, featureIdx: feature, distancePx: distPx }
      }
    }
  }
  return best
}
