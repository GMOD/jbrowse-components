import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import type { SortedBy } from '../shared/types'
import type {
  FeatureData,
  GapData,
  MismatchData,
} from '../shared/webglRpcTypes.ts'

export function computeLayout(features: FeatureData[]): Map<string, number> {
  const sorted = [...features].sort((a, b) => a.start - b.start)
  const levels: number[] = []
  const layoutMap = new Map<string, number>()

  for (const feature of sorted) {
    let y = 0
    for (const [i, level] of levels.entries()) {
      if (level <= feature.start) {
        y = i
        break
      }
      y = i + 1
    }
    layoutMap.set(feature.id, y)
    levels[y] = feature.end + 2
  }

  return layoutMap
}

// ASCII code for '*' used to represent deletions in base pair sort
const DELETION_CHAR = 42

function sortOverlapping(
  overlapping: FeatureData[],
  mismatches: MismatchData[],
  gaps: GapData[],
  tagValues: Map<string, string> | undefined,
  sortedBy: SortedBy,
) {
  const { type, pos } = sortedBy

  if (type === 'basePair') {
    // Build map: featureId → base code at sort position
    // Mismatches get their actual base, deletions get '*'
    const baseAtPos = new Map<string, number>()
    for (const mm of mismatches) {
      if (mm.position === pos) {
        baseAtPos.set(mm.featureId, mm.base)
      }
    }
    for (const gap of gaps) {
      if (gap.type === 'deletion' && gap.start <= pos && gap.end > pos) {
        if (!baseAtPos.has(gap.featureId)) {
          baseAtPos.set(gap.featureId, DELETION_CHAR)
        }
      }
    }

    overlapping.sort((a, b) => {
      const aBase = baseAtPos.get(a.id) ?? 0
      const bBase = baseAtPos.get(b.id) ?? 0
      if (aBase !== 0 && bBase === 0) {
        return -1
      }
      if (aBase === 0 && bBase !== 0) {
        return 1
      }
      return aBase - bBase
    })
  } else if (type === 'position') {
    overlapping.sort((a, b) => a.start - b.start)
  } else if (type === 'strand') {
    overlapping.sort((a, b) => b.strand - a.strand)
  } else if (type === 'tag' && tagValues) {
    const first = overlapping[0]
    const isString =
      first && Number.isNaN(Number(tagValues.get(first.id) ?? ''))
    if (isString) {
      overlapping.sort((a, b) => {
        const aVal = tagValues.get(a.id) ?? ''
        const bVal = tagValues.get(b.id) ?? ''
        return bVal.localeCompare(aVal)
      })
    } else {
      overlapping.sort((a, b) => {
        const aVal = Number(tagValues.get(a.id) ?? 0)
        const bVal = Number(tagValues.get(b.id) ?? 0)
        return bVal - aVal
      })
    }
  }
}

export function computeSortedLayout(
  features: FeatureData[],
  mismatches: MismatchData[],
  gaps: GapData[],
  tagValues: Map<string, string> | undefined,
  sortedBy: SortedBy,
) {
  const { pos } = sortedBy
  const overlapping: FeatureData[] = []
  const nonOverlapping: FeatureData[] = []
  for (const f of features) {
    if (f.start <= pos && f.end > pos) {
      overlapping.push(f)
    } else {
      nonOverlapping.push(f)
    }
  }

  sortOverlapping(overlapping, mismatches, gaps, tagValues, sortedBy)

  const layout = new GranularRectLayout({ pitchX: 1, pitchY: 1 })
  const layoutMap = new Map<string, number>()

  let nextRow = 0
  for (const f of overlapping) {
    const top = layout.addRect(
      f.id,
      f.start,
      f.end + 2,
      1,
      undefined,
      undefined,
      nextRow,
    )
    if (top !== null) {
      layoutMap.set(f.id, top)
      nextRow = top + 1
    }
  }

  for (const f of nonOverlapping) {
    const top = layout.addRect(f.id, f.start, f.end + 2, 1)
    if (top !== null) {
      layoutMap.set(f.id, top)
    }
  }

  return layoutMap
}
