import {
  attachLinkedReadLines,
  buildLaidOutChainMap,
} from './computeChainLayout.ts'
import { overlayReadTagColors } from './readTagColors.ts'
import { buildLaidOutPileupMap } from '../RenderAlignmentDataRPC/sortLayout.ts'

import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types.ts'
import type { ColorBy, SortedBy } from '../shared/types.ts'

export interface GroupLayout {
  // Group keys in stacking order — first-seen order across regions (the worker
  // already emits groups in a deterministic sorted order, untagged last).
  order: { key: string; label: string }[]
  // Per group key: region index → laid-out data (Y arrays filled).
  byGroup: Map<string, Map<number, PileupDataResult>>
}

// Lay out each group independently so one dense group can't starve the rest:
// every group runs the existing single/multi-region layout over just its own
// reads, capped at `maxRows` per group. Ungrouped fetches are the one-group
// case, so this reduces exactly to the previous `laidOutPileupMap`.
export function buildLaidOutByGroup({
  rpcDataMap,
  isChainMode,
  sortedBy,
  showSoftClipping,
  maxRows,
  maxRowsOverrides,
  showLinkedReadLines,
  colorBy,
  colorTagMap,
}: {
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>
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
}): GroupLayout {
  const order: { key: string; label: string }[] = []
  const seen = new Set<string>()
  for (const grouped of rpcDataMap.values()) {
    for (const g of grouped.groups) {
      if (!seen.has(g.key)) {
        seen.add(g.key)
        order.push({ key: g.key, label: g.label })
      }
    }
  }

  const byGroup = new Map<string, Map<number, PileupDataResult>>()
  for (const { key } of order) {
    const dataMap = new Map<number, PileupDataResult>()
    for (const [regionIdx, grouped] of rpcDataMap) {
      const group = grouped.groups.find(x => x.key === key)
      if (group) {
        dataMap.set(regionIdx, group.data)
      }
    }
    const base = isChainMode
      ? buildLaidOutChainMap(dataMap)
      : buildLaidOutPileupMap({
          dataMap,
          sortedBy,
          showSoftClipping,
          maxRows: maxRowsOverrides?.get(key) ?? maxRows,
        })
    const withLines = showLinkedReadLines ? attachLinkedReadLines(base) : base
    byGroup.set(key, overlayReadTagColors(withLines, colorBy, colorTagMap))
  }
  return { order, byGroup }
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
