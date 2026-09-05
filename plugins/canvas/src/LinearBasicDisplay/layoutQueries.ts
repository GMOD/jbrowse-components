import { isPlacedRow } from './rowPlacement.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// Unplaced features contribute no height, so a layout that hit the row limit
// reports a short height while holding fewer features;
// `countTruncatedFeatures` is how a caller finds out.
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

// Over `rectHeights`, the drawn primitives, not
// `flatbushItems[].featureHeightPx`, which is a gene's whole extent and
// nothing anyone draws; built on that, a 2px floor delivered a third of a
// pixel. Non-positive heights are skipped, or a degenerate `featureHeight: 0`
// config would disable the squeeze for the whole track.
export function minDrawnBoxHeight(
  map: ReadonlyMap<number, FeatureDataResult>,
  measureIds?: ReadonlySet<string>,
) {
  let min = Number.POSITIVE_INFINITY
  for (const data of map.values()) {
    const { rectHeights, rectFeatureIndices, flatbushItems } = data
    for (let i = 0; i < rectHeights.length; i++) {
      const height = rectHeights[i]!
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

// Counted over `measureIds` like `maxBottom`, so the "N not shown" sentence
// never counts features a pan would reveal.
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

// Strictly before, so a feature that merely abuts a block edge does not count
// as on screen.
function spansOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && aEnd > bStart
}

interface BlockMeasurableRegion {
  regionKey: string
  flatbushItems: readonly {
    featureId: string
    startBp: number
    endBp: number
  }[]
}

// Narrows the measurement only; the pack still places every buffered feature,
// so panning inside the buffer does not reshuffle rows. Regions match blocks
// by `regionKey`, since a region can be covered by several blocks and a block
// names its ref rather than the index.
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

// Same `isPlacedRow` test and `measureIds` narrowing as `maxBottom`, so a
// probe and the committed layout answer the same question.
export function packedRowsHeight(
  layoutMap: Map<string, number>,
  layoutHeights: Map<string, number>,
  measureIds?: ReadonlySet<string>,
) {
  let max = 0
  for (const [id, top] of layoutMap) {
    if (measureIds && !measureIds.has(id)) {
      continue
    }
    const bottom = top + layoutHeights.get(id)!
    if (isPlacedRow(top) && bottom > max) {
      max = bottom
    }
  }
  return max
}
