import { abgrAlpha } from '@jbrowse/core/util/colorBits'
import Flatbush from '@jbrowse/core/util/flatbush'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'

import { DOTPLOT_MARKS } from './dotplotMarks.ts'

import type {
  DotplotGeometryData,
  DotplotInstanceData,
  DotplotRenderState,
} from './dotplotRenderingBackendTypes.ts'

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
// geometry token, the same one `dotplotInstanceCache` keys its packed bytes
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

const SEGMENT_MARK = DOTPLOT_MARKS[0]!

// The segments the shape is asked to measure, LATER FIRST: `hitNearest` only
// replaces its best on a strictly nearer candidate, so a tie goes to whoever
// was offered first, and the one drawn on top is the later one. Feature runs
// are contiguous and disjoint, so sorting the runs by their start descending
// and walking each backwards is a globally descending segment order — which is
// what a whole-genome plot needs, where repeats collapse to dots at identical
// cumBp and Flatbush hands the boxes back in Hilbert order past `nodeSize`.
//
// A segment painted at zero alpha (a row `hideUnlabelled` hid) is left out
// rather than measured: nothing is on screen there, and which instances were
// painted at all is the caller's half of the split.
function* visibleSegments(
  index: DotplotPickIndex,
  data: DotplotGeometryData,
  boxIds: ArrayLike<number>,
) {
  const { instanceFeatureIdx, instanceCount, colors } = data
  const runs = Array.from(boxIds, boxId =>
    featureSegmentRange(
      instanceFeatureIdx,
      instanceCount,
      index.featureIdx[boxId]!,
    ),
  ).sort((a, b) => b[0] - a[0])
  for (const [start, end] of runs) {
    for (let s = end - 1; s >= start; s--) {
      if (abgrAlpha(colors[s]!) !== 0) {
        yield s
      }
    }
  }
}

/**
 * The feature nearest a cursor position within `tolerancePx`, or undefined.
 *
 * NEAREST wins, where `syntenyPickEngine` takes the topmost. A ribbon is an
 * opaque fill, so "which one is on top" is what the user sees and the only
 * defensible answer; a dotplot is thin lines over each other, where the nearest
 * is what the cursor is pointing at. Ties go to the later segment, which is the
 * one drawn on top — see `visibleSegments`.
 *
 * The exact test measures in PX, not bp. The two axes are independently scaled
 * (and routinely differ by orders of magnitude on a read-vs-ref plot), so a bp
 * distance would pick a feature far away on the compressed axis over one under
 * the cursor. It is the mark shape's own measurement: this narrows the
 * candidates the index answered and applies the display's tolerance, and where
 * the ink is comes from the same object that packs and paints it.
 */
export function pickDotplotFeature({
  data,
  state,
  x,
  y,
  tolerancePx,
}: {
  data: DotplotGeometryData
  // component px, y measured downward from the top of the plot
  x: number
  y: number
  state: DotplotRenderState
  tolerancePx: number
}): DotplotPickHit | undefined {
  const index = getPickIndex(data)
  if (!index) {
    return undefined
  }
  const { viewBpH, viewBpV, bpPerPxHInv, bpPerPxVInv, canvasHeight } = state
  const bpPerPxH = 1 / bpPerPxHInv
  const bpPerPxV = 1 / bpPerPxVInv
  const cursorBpH = viewBpH + x * bpPerPxH
  const cursorBpV = viewBpV + (canvasHeight - y) * bpPerPxV
  // The tolerance is a px radius, so it is a different bp distance on each axis.
  const tolH = tolerancePx * bpPerPxH
  const tolV = tolerancePx * bpPerPxV
  const boxIds = index.flatbush.search(
    cursorBpH - tolH,
    cursorBpV - tolV,
    cursorBpH + tolH,
    cursorBpV + tolV,
  )
  // The block is the one the display draws with, minus the key nobody asks for
  // here: the shape places its ink from the payload and the frame, never from
  // the block's bp span. The bound is unbounded and the tolerance applied
  // after, so the answer is the nearest ink and then whether it is close
  // enough — inclusively, the way it has always been.
  const hit = SEGMENT_MARK.hitNearest!(
    data,
    canvasWideBlock(0, state.canvasWidth),
    state,
    x,
    y,
    visibleSegments(index, data, boxIds),
    Number.POSITIVE_INFINITY,
  )
  if (hit === undefined) {
    return undefined
  }
  const distancePx = Math.sqrt(hit.distSq)
  return distancePx <= tolerancePx
    ? {
        segmentIdx: hit.index,
        featureIdx: data.instanceFeatureIdx[hit.index]!,
        distancePx,
      }
    : undefined
}
