import {
  classifyConnection,
  svSignalTier,
  flagsOf,
  isConcordantPairRead,
  pairFieldEntry,
  readGroupConnections,
  readIdAt,
  readNameAt,
} from '@jbrowse/alignments-core'

import { isLevelPairMinimized } from './util.ts'

import type { ConnectorRow, LayoutRecord } from './types.ts'
import type { RefNameCanonicalizer } from './util.ts'
import type {
  ClassifiedConnection,
  ConnectionReadArrays,
  ReadConnection,
  ReadIdentity,
  ReadNames,
} from '@jbrowse/alignments-core'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

export interface OverlayReadArrays
  extends ConnectionReadArrays, ReadIdentity, ReadNames {
  readCategoryBits: Uint8Array
}

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
  /** how the display's own connectors paint a connection, in `theme` */
  connectorStylerIn: (theme: JBrowsePalette) => ConnectorStyler
}

/** A connection's color and key label, as the display that holds `e1` paints it. */
export type ConnectorStyler = (
  e1: ReadEntry,
  e2: ReadEntry,
  isSplit: boolean,
  crossesChromosomes: boolean,
) => { color: string; label: string }

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

// The `svSignal` definition the read filter and the sort use (ADR-229), read
// by read rather than by chain: the filter keeps a split read's concordant
// mate, but a curve to it would show no rearrangement.
export function isEvidenceRead(data: OverlayReadArrays, i: number) {
  return svSignalTier(data.readCategoryBits[i]!) > 0
}

// A junction is always evidence; a mate link only for a pair the aligner did
// not call concordant, so two split mates of a proper pair draw their
// junctions and no link between them.
function isEvidenceLink(c: ReadConnection<ReadEntry>) {
  const src = pairFieldEntry(c.e1, c.e2)
  return (
    c.isSplit ||
    !isConcordantPairRead(
      flagsOf(src),
      src.data.readPairOrientations[src.readIdx]!,
    )
  )
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
 * The SV evidence reads across every row, grouped by read name and resolved
 * into split junctions and mate links.
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
            const name = isEvidenceRead(data, i) ? readNameAt(data, i) : ''
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
      ).filter(isEvidenceLink)
      if (connections.length > 0) {
        chains.push({ entries, connections })
      }
    }
  }
  return chains
}

interface BlockSpan {
  refName: string
  start: number
  end: number
}

/**
 * Each on-screen chain entry's layout rect in its own row's display. A read in
 * the display's prefetch margin has a layout too, but no place in the panel.
 */
export function layoutReadChains(
  chains: ReadChain[],
  sources: (ReadSource | undefined)[],
  blocksByLevel: BlockSpan[][],
) {
  const layouts = new Map<ReadEntry, LayoutRecord>()
  const onScreen = (e: ReadEntry) => {
    const { start, end } = readSpanOf(e)
    return !!blocksByLevel[e.level]?.some(
      b => b.refName === e.refName && b.start < end && start < b.end,
    )
  }
  for (const { entries } of chains) {
    for (const e of entries.filter(onScreen)) {
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

export interface DrawnConnection extends ClassifiedConnection {
  connection: ReadConnection<ReadEntry>
  /** the read chain it belongs to, so a hover can emphasize the whole route */
  chainIndex: number
  c1: LayoutRecord
  c2: LayoutRecord
}

// The alignment connectors the overlay draws, each classified: every link the
// panels do not draw themselves. A read laid out in no row has no end to draw
// to, and a pileup that links its own reads already draws the ones inside it.
export function* drawnConnections({
  chains,
  entryLayouts,
  rows,
}: {
  chains: ReadChain[]
  entryLayouts: ReadonlyMap<ReadEntry, LayoutRecord>
  rows: ConnectorRow[]
}): Generator<DrawnConnection> {
  for (const [chainIndex, { connections }] of chains.entries()) {
    for (const connection of connections) {
      const { e1, e2 } = connection
      const c1 = entryLayouts.get(e1)
      const c2 = entryLayouts.get(e2)
      if (
        !c1 ||
        !c2 ||
        isLevelPairMinimized(rows, e1.level, e2.level) ||
        (e1.level === e2.level && rows[e1.level]?.linksReads)
      ) {
        continue
      }
      yield {
        ...classifyConnection(connection),
        connection,
        chainIndex,
        c1,
        c2,
      }
    }
  }
}
