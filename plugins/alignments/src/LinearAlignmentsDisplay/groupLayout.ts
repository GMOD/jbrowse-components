import {
  attachLinkedReadLines,
  buildLaidOutChainMap,
} from './computeChainLayout.ts'
import { overlayReadTagColors } from './readTagColors.ts'
import { buildLaidOutPileupMap } from '../RenderAlignmentDataRPC/sortLayout.ts'

import type { GroupId } from './groupedDataMaps.ts'
import type { RegionBounds } from '../RenderAlignmentDataRPC/sortLayout.ts'
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
  regions,
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
  // Region bounds by displayed-region index, so multi-region layout can locate
  // the sort position's region and detect the single-refName case.
  regions: ReadonlyMap<number, RegionBounds>
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
    const cap = maxRowsOverrides?.get(key) ?? maxRows
    const base = isChainMode
      ? buildLaidOutChainMap(dataMap, cap)
      : buildLaidOutPileupMap({
          dataMap,
          sortedBy,
          showSoftClipping,
          regions,
          maxRows: cap,
        })
    const withLines = showLinkedReadLines ? attachLinkedReadLines(base) : base
    byGroup.set(key, overlayReadTagColors(withLines, colorBy, colorTagMap))
  }
  return byGroup
}

// Equal-split row budget per group when grouping fits to the viewport: every
// group still reserves its band overhead (coverage/arcs/sashimi) even when
// collapsed, so subtract `groupCount * overhead`, then divide the remaining
// height across only the `visibleGroupCount` groups that actually draw a pileup.
// Collapsing a group thus hands its pileup slice back to the ones still shown,
// keeping the stack fit to the viewport without dead space. Floored to a few
// rows so a tiny viewport or many groups still shows pileup (the overflow then
// scrolls), and never exceeds the display-wide `maxRows` cap. A group with fewer
// reads than its slice simply lays out all of them — the cap only truncates
// deeper groups.
export const MIN_FIT_ROWS = 3
export function fitGroupMaxRows({
  height,
  groupCount,
  visibleGroupCount,
  rowHeight,
  overhead,
  maxRows,
}: {
  height: number
  groupCount: number
  // Non-collapsed groups sharing the pileup budget; falls back to 1 so an
  // all-collapsed stack (no pileup drawn anyway) never divides by zero.
  visibleGroupCount: number
  rowHeight: number
  overhead: number
  maxRows: number
}) {
  const pileupBudget = height - groupCount * overhead
  const slice = pileupBudget / Math.max(1, visibleGroupCount)
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

// True when the row cap clipped any region of a group's laid-out map, i.e.
// reads were collapsed to the overflow sentinel. Drives the per-group "show
// all" affordance and the ungrouped truncation banner.
export function anyRegionTruncated(map: Map<number, PileupDataResult>) {
  for (const data of map.values()) {
    if (data.truncated) {
      return true
    }
  }
  return false
}
