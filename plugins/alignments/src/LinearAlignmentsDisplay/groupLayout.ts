import {
  attachLinkedReadLines,
  buildLaidOutChainMap,
} from './computeChainLayout.ts'
import { overlayReadTagColors } from './readTagColors.ts'
import { buildLaidOutPileupMap } from '../RenderAlignmentDataRPC/sortLayout.ts'

import type { GroupId } from './groupedDataMaps.ts'
import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { ColorBy, SortedBy } from '../shared/types.ts'

// Per group key: region index → laid-out data (Y arrays filled).
export type LaidOutByGroup = Map<string, Map<number, PileupDataResult>>

// Lay out each group independently so one dense group can't starve the rest:
// every group runs the existing single/multi-region layout over just its own
// reads, capped at `maxRows` per group. Ungrouped fetches are the one-group
// case, so this reduces exactly to the previous `laidOutPileupMap`. Stacking
// order is the caller's `order` (see `orderedGroups`), so this stays purely a
// layout pass — it doesn't re-derive group identity.
export function buildLaidOutByGroup({
  order,
  rawByGroup,
  isChainMode,
  sortedBy,
  showSoftClipping,
  maxRows,
  maxRowsOverrides,
  showLinkedReadLines,
  colorBy,
  colorTagMap,
}: {
  order: GroupId[]
  // Pre-grouped raw data (group key → region idx → data) from
  // `buildRawDataByGroup`; reused here so the per-key region map is an O(1)
  // lookup instead of re-partitioning `rpcDataMap` with a nested `.find`.
  rawByGroup: ReadonlyMap<string, Map<number, PileupDataResult>>
  isChainMode: boolean
  sortedBy: SortedBy | undefined
  showSoftClipping: boolean
  maxRows: number
  // Per-group row caps (from per-group height drags); a key falls back to the
  // display-wide `maxRows` when absent.
  maxRowsOverrides?: ReadonlyMap<string, number>
  showLinkedReadLines: boolean
  colorBy: ColorBy | undefined
  colorTagMap: Record<string, string>
}): LaidOutByGroup {
  const byGroup: LaidOutByGroup = new Map()
  for (const { key } of order) {
    const dataMap = rawByGroup.get(key) ?? new Map<number, PileupDataResult>()
    const base = isChainMode
      ? buildLaidOutChainMap(dataMap, maxRowsOverrides?.get(key) ?? maxRows)
      : buildLaidOutPileupMap({
          dataMap,
          sortedBy,
          showSoftClipping,
          maxRows: maxRowsOverrides?.get(key) ?? maxRows,
        })
    const withLines = showLinkedReadLines ? attachLinkedReadLines(base) : base
    byGroup.set(key, overlayReadTagColors(withLines, colorBy, colorTagMap))
  }
  return byGroup
}

// Equal-split row budget per group when grouping fits to the viewport: divide
// the height left after each section's band overhead (coverage/arcs/sashimi)
// evenly across the N groups, so the stacked groups fit without scrolling and
// the wheel stays unambiguously zoom. Floored to a few rows so a tiny viewport
// or many groups still shows pileup (the overflow then scrolls), and never
// exceeds the display-wide `maxRows` cap. A group with fewer reads than its
// slice simply lays out all of them — the cap only truncates deeper groups.
export const MIN_FIT_ROWS = 3
export function fitGroupMaxRows({
  height,
  groupCount,
  rowHeight,
  overhead,
  maxRows,
}: {
  height: number
  groupCount: number
  rowHeight: number
  overhead: number
  maxRows: number
}) {
  const slice = (height - groupCount * overhead) / groupCount
  const rows = Math.max(MIN_FIT_ROWS, Math.floor(slice / rowHeight))
  return Math.min(maxRows, rows)
}

// Max row count for a group's laid-out region map (sections stack by this).
export function groupMaxY(map: Map<number, PileupDataResult>) {
  let max = 0
  for (const data of map.values()) {
    if (data.maxY > max) {
      max = data.maxY
    }
  }
  return max
}
