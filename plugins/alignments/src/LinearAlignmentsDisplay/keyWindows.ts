import { touchesAny, windowsByRegion } from '@jbrowse/display-kit/keyWindows'

import { ARC_COLOR_INTERCHROM } from '../features/arcs/arcColors.ts'
import { MAPQ_UNAVAILABLE } from '../shared/util.ts'
import { READ_COLOR_CATEGORY_BY_INDEX } from './colorUtils.ts'

import type {
  PileupLayoutArrays,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { CrossRegionArc } from '../features/arcs/arcTypes.ts'
import type { ArcsUploadData } from '../features/arcs/types.ts'
import type { GroupConnectors } from '../features/linkedReads/computeOverlay.ts'
import type { MergedJunction } from '../features/sashimi/junctions.ts'
import type { ReadColorCategory } from './colorUtils.ts'
import type { KeyWindow } from '@jbrowse/display-kit/keyWindows'

type ByGroup<D> = ReadonlyMap<string, ReadonlyMap<number, D>>

type Reads<K extends keyof WorkerPileupData> = ByGroup<
  Pick<WorkerPileupData, 'readPositions' | K>
>

/** The read-color buckets of the reads that touch a window. */
export function readCategoriesInWindows(
  byGroup: ByGroup<
    Pick<WorkerPileupData, 'readPositions'> & {
      readColorCategories: Uint8Array
    }
  >,
  windows: readonly KeyWindow[],
) {
  const regions = windowsByRegion(windows)
  const present = new Set<ReadColorCategory>()
  for (const map of byGroup.values()) {
    for (const [regionIndex, d] of map) {
      const ranges = regions.get(regionIndex)
      if (ranges) {
        const pos = d.readPositions
        const cats = d.readColorCategories
        for (let i = 0; i < cats.length; i++) {
          if (touchesAny(ranges, pos[i * 2]!, pos[i * 2 + 1]!)) {
            present.add(READ_COLOR_CATEGORY_BY_INDEX[cats[i]!]!)
          }
        }
      }
    }
  }
  return present
}

/** The MAPQs of the reads that touch a window, as a categorical key lists them. */
export function readMapqsInWindows(
  byGroup: Reads<'readMapqs'>,
  windows: readonly KeyWindow[],
) {
  const regions = windowsByRegion(windows)
  const seen = new Uint8Array(MAPQ_UNAVAILABLE)
  for (const map of byGroup.values()) {
    for (const [regionIndex, d] of map) {
      const ranges = regions.get(regionIndex)
      if (ranges) {
        const pos = d.readPositions
        const mapqs = d.readMapqs
        for (let i = 0; i < mapqs.length; i++) {
          if (touchesAny(ranges, pos[i * 2]!, pos[i * 2 + 1]!)) {
            seen[mapqs[i]!] = 1
          }
        }
      }
    }
  }
  const present = new Set<string>()
  seen.forEach((hit, mapq) => {
    if (hit) {
      present.add(`${mapq}`)
    }
  })
  return present
}

/** The tag or mate values of the reads that touch a window. */
export function readTagValuesInWindows(
  byGroup: Reads<'readTagValues'>,
  windows: readonly KeyWindow[],
) {
  const regions = windowsByRegion(windows)
  const present = new Set<string>()
  for (const map of byGroup.values()) {
    for (const [regionIndex, d] of map) {
      const ranges = regions.get(regionIndex)
      const values = d.readTagValues
      if (ranges && values) {
        const pos = d.readPositions
        for (let i = 0; i < values.length; i++) {
          if (touchesAny(ranges, pos[i * 2]!, pos[i * 2 + 1]!)) {
            present.add(values[i]!)
          }
        }
      }
    }
  }
  return present
}

/**
 * The modification types of the calls inside a window. A region's walk stops
 * once it has found every type the region carries, since a deep modBAM holds
 * millions of calls and a key has a handful of rows.
 */
export function modificationTypesInWindows(
  byGroup: ByGroup<
    Pick<
      WorkerPileupData,
      'modificationPositions' | 'modificationTypeIndices' | 'modificationTypes'
    >
  >,
  windows: readonly KeyWindow[],
) {
  const regions = windowsByRegion(windows)
  const present = new Set<string>()
  for (const map of byGroup.values()) {
    for (const [regionIndex, d] of map) {
      const ranges = regions.get(regionIndex)
      const types = d.modificationTypes
      if (ranges && types) {
        const pos = d.modificationPositions
        const typeIdx = d.modificationTypeIndices
        const found = new Set<string>()
        for (let i = 0; i < pos.length && found.size < types.length; i++) {
          if (touchesAny(ranges, pos[i]!, pos[i]! + 1)) {
            found.add(types[typeIdx?.[i] ?? 0]!)
          }
        }
        for (const type of found) {
          present.add(type)
        }
      }
    }
  }
  return present
}

/** The kinds of the chain or collapsed-row overlap intervals touching a window. */
export function overlapKindsInWindows(
  byGroup: ByGroup<
    Pick<PileupLayoutArrays, 'overlapPositions' | 'overlapKinds'>
  >,
  windows: readonly KeyWindow[],
) {
  const regions = windowsByRegion(windows)
  const present = new Set<number>()
  for (const map of byGroup.values()) {
    for (const [regionIndex, d] of map) {
      const ranges = regions.get(regionIndex)
      if (ranges) {
        const pos = d.overlapPositions
        for (let i = 0; i < pos.length; i += 2) {
          if (touchesAny(ranges, pos[i]!, pos[i + 1]!)) {
            present.add(d.overlapKinds[i / 2]!)
          }
        }
      }
    }
  }
  return present
}

/**
 * The connection color slots drawn in a window: an arc whose span touches
 * one, since its dome crosses the screen whichever feet are on it, a tick at
 * its foot, and an arc between displayed regions where either region shows.
 */
export function arcSlotsInWindows(
  {
    byGroup,
    crossRegionByGroup,
  }: {
    byGroup: ByGroup<
      Pick<
        ArcsUploadData,
        | 'numArcs'
        | 'arcX1'
        | 'arcX2'
        | 'arcColorTypes'
        | 'numArcLines'
        | 'arcLinePositions'
      >
    >
    crossRegionByGroup: ReadonlyMap<
      string,
      readonly Pick<
        CrossRegionArc,
        'colorType' | 'p1RegionIndex' | 'p2RegionIndex'
      >[]
    >
  },
  windows: readonly KeyWindow[],
) {
  const regions = windowsByRegion(windows)
  const present = new Set<number>()
  for (const map of byGroup.values()) {
    for (const [regionIndex, d] of map) {
      const ranges = regions.get(regionIndex)
      if (ranges) {
        for (let i = 0; i < d.numArcs; i++) {
          const a = d.arcX1[i]!
          const b = d.arcX2[i]!
          if (touchesAny(ranges, Math.min(a, b), Math.max(a, b) + 1)) {
            present.add(d.arcColorTypes[i]!)
          }
        }
        for (let i = 0; i < d.numArcLines; i++) {
          const p = d.arcLinePositions[i]!
          if (touchesAny(ranges, p, p + 1)) {
            present.add(ARC_COLOR_INTERCHROM)
          }
        }
      }
    }
  }
  for (const arcs of crossRegionByGroup.values()) {
    for (const arc of arcs) {
      if (regions.has(arc.p1RegionIndex) || regions.has(arc.p2RegionIndex)) {
        present.add(arc.colorType)
      }
    }
  }
  return present
}

/** The connector color slots with a foot in a window. */
export function connectorSlotsInWindows(
  connectorsByGroup: ReadonlyMap<string, GroupConnectors>,
  windows: readonly KeyWindow[],
) {
  const regions = windowsByRegion(windows)
  const present = new Set<number>()
  for (const { lines, overlayPairs } of connectorsByGroup.values()) {
    for (const [regionIndex, region] of lines) {
      const ranges = regions.get(regionIndex)
      if (ranges) {
        const pos = region.linkedReadLinePositions
        for (let i = 0; i < region.numLinkedReadLines; i++) {
          const a = pos[i * 2]!
          const b = pos[i * 2 + 1]!
          if (touchesAny(ranges, Math.min(a, b), Math.max(a, b) + 1)) {
            present.add(region.linkedReadLineColorTypes[i]!)
          }
        }
      }
    }
    for (const { e1, e2, c } of overlayPairs) {
      const r1 = regions.get(e1.displayedRegionIndex)
      const r2 = regions.get(e2.displayedRegionIndex)
      if (
        (r1 && touchesAny(r1, c.bp1, c.bp1 + 1)) ||
        (r2 && touchesAny(r2, c.bp2, c.bp2 + 1))
      ) {
        present.add(c.colorType)
      }
    }
  }
  return present
}

/** Whether a junction's span touches a window on its reference. */
export function junctionInWindows(
  junction: Pick<MergedJunction, 'refName' | 'start' | 'end'>,
  windows: readonly KeyWindow[],
) {
  for (const w of windows) {
    if (
      w.refName === junction.refName &&
      junction.start < w.end &&
      junction.end > w.start
    ) {
      return true
    }
  }
  return false
}

/**
 * The insert-size band every region touching a window classifies by, which a
 * key can state in bp; undefined where a region has none or two disagree.
 */
export function insertSizeBandInWindows(
  byGroup: ByGroup<Pick<WorkerPileupData, 'insertSizeStats'>>,
  windows: readonly KeyWindow[],
) {
  const regions = windowsByRegion(windows)
  const bands = new Map<string, { lower: number; upper: number }>()
  let unsampled = false
  for (const map of byGroup.values()) {
    for (const [regionIndex, { insertSizeStats }] of map) {
      if (regions.has(regionIndex)) {
        if (insertSizeStats) {
          bands.set(
            `${insertSizeStats.lower}:${insertSizeStats.upper}`,
            insertSizeStats,
          )
        } else {
          unsampled = true
        }
      }
    }
  }
  return bands.size === 1 && !unsampled ? [...bands.values()][0] : undefined
}
