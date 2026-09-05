import { isPlacedRow } from './rowPlacement.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// Measurements over an already-laid-out result: how tall it is, how small its
// smallest drawn box is, how many features the packer could not place, and which
// features touch the blocks on screen. Every one is a read — nothing here packs,
// scales or mutates a layout — which is what lets the fit ladder and the model
// call them without reaching into the packer.

// Tallest row bottom across a layout, i.e. its content height. Unplaced features
// are excluded — they don't render, so they contribute no height — which also
// means a layout that hit the row limit reports a SHORT height while silently
// holding fewer features than it was given. `countTruncatedFeatures` is how a
// caller finds out.
//
// `measureIds`, when given, restricts the measurement to those features. Fit
// mode passes the ones on screen: the fetch buffers half a viewport either side,
// and those off-screen features pack into rows of their own that add height
// while drawing nothing in view (see `fitMeasureFeatureIds`).
export function maxBottom(
  map: ReadonlyMap<number, FeatureDataResult>,
  measureIds?: ReadonlySet<string>,
) {
  let max = 0
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (
        isPlacedRow(item.topPx) &&
        item.bottomPx > max &&
        (!measureIds || measureIds.has(item.featureId))
      ) {
        max = item.bottomPx
      }
    }
  }
  return max
}

// The shortest box the layout actually DRAWS — the one a uniform vertical
// squeeze takes below a visible size first, and so the basis for the squeeze
// floor (see `fitSmallestBoxPx`). 0 when nothing is drawn, which callers read as
// "nothing to size" and turn into a no-op bound.
//
// Measured over `rectHeights`, the emitted rect primitives, and NOT over
// `flatbushItems[].featureHeightPx`. That field is the feature's whole laid-out
// EXTENT — for a gene, `layout.height`, every stacked transcript plus its label
// rows — which is nothing anyone draws. Built on it, a floor of MIN_FIT_BOX_PX
// promised 2px boxes and delivered a fifth of that: a 5-transcript gene extends
// ~70px, so the floor allowed a 0.03 squeeze and each 10px transcript rect
// rendered at a third of a pixel. The promise is about boxes, so measure boxes.
//
// A rect's feature is `rectFeatureIndices[i]`, so the two filters below are the
// same ones `maxBottom` applies, asked of the rect's owner: unplaced features are
// excluded because they don't render, and `measureIds` narrows to the on-screen
// set exactly as it does there — fit mode passes the same set to both, so the
// squeeze is bounded by the stack it is chosen against rather than by the fetch
// buffer. It is the SHORTEST box that binds, so either filter left off can only
// raise the floor: one buffered 2px mark half a viewport away pinned it at 1 and
// stopped the visible stack squeezing at all.
//
// Non-positive heights are skipped rather than winning: a box already drawing
// nothing cannot be shrunk to invisibility, and letting a degenerate
// `featureHeight: 0` config answer 0 here would silently disable the squeeze for
// the whole track.
export function minDrawnBoxHeight(
  map: ReadonlyMap<number, FeatureDataResult>,
  measureIds?: ReadonlySet<string>,
) {
  let min = Number.POSITIVE_INFINITY
  for (const data of map.values()) {
    const { rectHeights, rectFeatureIndices, flatbushItems } = data
    for (let i = 0; i < rectHeights.length; i++) {
      const height = rectHeights[i]!
      // Cheap test first: most rects lose on height alone, and the owner lookup
      // is only worth doing for one that would win.
      if (height <= 0 || height >= min) {
        continue
      }
      const owner = flatbushItems[rectFeatureIndices[i]!]
      if (
        owner &&
        isPlacedRow(owner.topPx) &&
        (!measureIds || measureIds.has(owner.featureId))
      ) {
        min = height
      }
    }
  }
  return min === Number.POSITIVE_INFINITY ? 0 : min
}

// Features the packer could not place because the stack passed
// GranularRectLayout's row limit, and so pushed to OFFSCREEN_Y where nothing
// draws or hit-tests them. Counted off the laid-out map (a feature appearing in
// several regions of one ref-group shares a row, so it is counted once per region
// it appears in — the same basis as maxBottom). Non-zero means the display is
// showing the user strictly less than the data it holds, which fit mode in
// particular must own up to rather than present as a complete picture.
//
// `measureIds` narrows it the way it narrows `maxBottom` and `minDrawnBoxHeight`,
// fit mode passes the same on-screen set to all three. The count is surfaced as
// "N not shown (past the layout row limit; filter or zoom in)", and counting the
// fetch buffer put features half a viewport away — which panning, not filtering,
// reveals — into that sentence. An unplaced feature still carries its bp span, so
// membership is answerable even though its row is not.
export function countTruncatedFeatures(
  map: ReadonlyMap<number, FeatureDataResult>,
  measureIds?: ReadonlySet<string>,
) {
  let n = 0
  for (const data of map.values()) {
    for (const item of data.flatbushItems) {
      if (
        !isPlacedRow(item.topPx) &&
        (!measureIds || measureIds.has(item.featureId))
      ) {
        n++
      }
    }
  }
  return n
}

// Do two half-open bp spans touch? Each must start strictly before the other
// ends, so a feature that merely abuts a block edge — ending exactly where the
// block starts, drawing nothing inside it — does not count as on screen.
function spansOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && aEnd > bStart
}

// What `featureIdsTouchingBlocks` needs from one fetched region: which ref-group
// it holds and each feature's absolute bp span. A structural subset of the
// model's `LoadedFeatureData`, kept local so this stays a pure function decoupled
// from the RPC-result shape (same idiom as featureHighlight.ts).
interface BlockMeasurableRegion {
  // `assemblyName:refName`, matched against a block's own pair
  regionKey: string
  flatbushItems: readonly {
    featureId: string
    startBp: number
    endBp: number
  }[]
}

// The features whose bp span touches one of `blocks` — the "on screen" set fit
// mode measures its candidate stacks over (see `fitMeasureFeatureIds`).
//
// The fetch deliberately buffers half a screen either side
// (`bufferedVisibleRegions`), and every one of those off-screen features claims a
// row — rows that add stack height but draw nothing in view. Measuring the whole
// packed stack therefore squeezed the boxes and stripped the labels to fit
// features the user cannot see: a viewport holding eight genes could land on the
// `bodies` rung at the minimum box size because twenty more sat just outside it.
//
// It narrows the MEASUREMENT only — the pack still places every buffered feature,
// so panning inside the buffer doesn't reshuffle rows.
//
// Regions are matched to blocks by `regionKey`, not by displayed-region index: a
// region can be covered by several blocks, and a block names its ref rather than
// the index. An off-by-one in the overlap test silently widens or narrows what fit
// mode measures itself against, which is why `spansOverlap` above has a test of
// its own.
export function featureIdsTouchingBlocks(
  regions: Iterable<BlockMeasurableRegion>,
  blocks: readonly {
    assemblyName: string
    refName: string
    start: number
    end: number
  }[],
): ReadonlySet<string> {
  const rangesByKey = new Map<string, [number, number][]>()
  for (const block of blocks) {
    const key = `${block.assemblyName}:${block.refName}`
    let ranges = rangesByKey.get(key)
    if (!ranges) {
      ranges = []
      rangesByKey.set(key, ranges)
    }
    ranges.push([block.start, block.end])
  }
  const ids = new Set<string>()
  for (const data of regions) {
    const ranges = rangesByKey.get(data.regionKey)
    if (!ranges) {
      continue
    }
    for (const item of data.flatbushItems) {
      if (
        ranges.some(([start, end]) =>
          spansOverlap(item.startBp, item.endBp, start, end),
        )
      ) {
        ids.add(item.featureId)
      }
    }
  }
  return ids
}
