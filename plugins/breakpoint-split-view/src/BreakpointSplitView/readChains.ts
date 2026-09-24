import {
  flagsOf,
  isConcordantPairRead,
  pairFieldEntry,
  readGroupConnections,
  readIdAt,
  readNameAt,
} from '@jbrowse/alignments-core'
import { SAM_FLAG_PAIRED } from '@jbrowse/cigar-utils'

import type { LayoutRecord } from './types.ts'
import type { RefNameCanonicalizer } from './util.ts'
import type {
  ConnectionReadArrays,
  ReadConnection,
  ReadIdentity,
  ReadNames,
} from '@jbrowse/alignments-core'

export interface OverlayReadArrays
  extends ConnectionReadArrays, ReadIdentity, ReadNames {}

/** What the split view reads off an alignments display in one of its rows. */
export interface ReadSource {
  readArraysByGroup: ReadonlyMap<string, ReadonlyMap<number, OverlayReadArrays>>
  loadedRegions: {
    get: (displayedRegionIndex: number) => { refName: string } | undefined
  }
  readLayoutRecord: (
    groupKey: string,
    displayedRegionIndex: number,
    idx: number,
  ) => LayoutRecord | undefined
}

export interface ReadEntry {
  level: number
  groupKey: string
  displayedRegionIndex: number
  refName: string
  data: OverlayReadArrays
  readIdx: number
}

/** One read name's segments across every row, and what connects them. */
export interface ReadChain {
  entries: ReadEntry[]
  connections: ReadConnection<ReadEntry>[]
}

function orientationOf(e: ReadEntry) {
  return e.data.readPairOrientations[e.readIdx]!
}

function mayConnect(data: OverlayReadArrays, i: number) {
  const flags = data.readFlags[i]!
  return (
    !!data.readSuppAlignments?.[i] ||
    (!!(flags & SAM_FLAG_PAIRED) &&
      !isConcordantPairRead(flags, data.readPairOrientations[i]!))
  )
}

function isEvidence(c: ReadConnection<ReadEntry>) {
  const src = pairFieldEntry(c.e1, c.e2)
  return c.isSplit || !isConcordantPairRead(flagsOf(src), orientationOf(src))
}

export function readIdOf(e: ReadEntry) {
  return readIdAt(e.data, e.readIdx) ?? ''
}

export function readNameOf(e: ReadEntry) {
  return readNameAt(e.data, e.readIdx)
}

export function readSpanOf(e: ReadEntry) {
  return {
    start: e.data.readPositions[e.readIdx * 2]!,
    end: e.data.readPositions[e.readIdx * 2 + 1]!,
  }
}

/**
 * The split reads and discordant pairs across every row, grouped by read name
 * and resolved into split junctions and mate links. A concordant pair's link is
 * left out, being no evidence of a rearrangement.
 */
export function buildReadChains(
  sources: (ReadSource | undefined)[],
  assemblies: (RefNameCanonicalizer | undefined)[],
): ReadChain[] {
  const byName = new Map<string, ReadEntry[]>()
  for (const [level, source] of sources.entries()) {
    for (const [groupKey, byRegion] of source?.readArraysByGroup ?? []) {
      for (const [displayedRegionIndex, data] of byRegion) {
        const refName = source!.loadedRegions.get(displayedRegionIndex)?.refName
        if (refName !== undefined) {
          for (let i = 0; i < data.readKeys.length; i++) {
            const name = mayConnect(data, i) ? readNameAt(data, i) : ''
            if (name) {
              const entry = {
                level,
                groupKey,
                displayedRegionIndex,
                refName,
                data,
                readIdx: i,
              }
              const entries = byName.get(name)
              if (entries) {
                entries.push(entry)
              } else {
                byName.set(name, [entry])
              }
            }
          }
        }
      }
    }
  }
  const chains: ReadChain[] = []
  for (const entries of byName.values()) {
    if (entries.length >= 2) {
      const assembly = assemblies[entries[0]!.level]
      const connections = readGroupConnections(entries, refName =>
        assembly ? assembly.getCanonicalRefName2(refName) : refName,
      ).filter(isEvidence)
      if (connections.length > 0) {
        chains.push({ entries, connections })
      }
    }
  }
  return chains
}

/** Each chain entry's layout rect in its own row's display. */
export function layoutReadChains(
  chains: ReadChain[],
  sources: (ReadSource | undefined)[],
) {
  const layouts = new Map<ReadEntry, LayoutRecord>()
  for (const { entries } of chains) {
    for (const e of entries) {
      const layout = sources[e.level]?.readLayoutRecord(
        e.groupKey,
        e.displayedRegionIndex,
        e.readIdx,
      )
      if (layout) {
        layouts.set(e, layout)
      }
    }
  }
  return layouts
}
