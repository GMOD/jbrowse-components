import {
  getEdgesForOrdinals,
  mergeOrdinalRanges,
  orientChar,
} from './gfaBinaryIO.ts'

import type { IndexedBinaryShard, SegRecord } from './gfaBinaryIO.ts'

export type FetchSegmentsForOrdinals = (
  ranges: [number, number][],
) => Promise<SegRecord[]>

// `L a oA b oB` and `L b ~oB a ~oA` are the same physical bidirected edge.
// Pick the lexicographically smaller of (forward, reverse-partner) as the
// canonical form so emission de-duplicates regardless of which side we read
// the adjacency from.
function canonicalLinkKey(
  srcOrd: number,
  srcO: string,
  tgtOrd: number,
  tgtO: string,
) {
  const flip = (o: string) => (o === '+' ? '-' : '+')
  const forward = `s${srcOrd}\t${srcO}\ts${tgtOrd}\t${tgtO}`
  const reverse = `s${tgtOrd}\t${flip(tgtO)}\ts${srcOrd}\t${flip(srcO)}`
  return forward < reverse ? forward : reverse
}

export async function buildGfaFromEdges(
  viewportRefOrds: number[],
  segLens: Map<number, number>,
  edgeShard: IndexedBinaryShard,
  fetchSegments: FetchSegmentsForOrdinals,
  pathNames: string[],
  seedSegments: SegRecord[],
) {
  const edgeMap = await getEdgesForOrdinals(edgeShard, viewportRefOrds)
  const allNodeOrds = new Set(viewportRefOrds)
  const gfaLinks = new Set<string>()

  for (const [srcOrd, edges] of edgeMap) {
    for (const edge of edges) {
      allNodeOrds.add(edge.targetOrd)
      segLens.set(edge.targetOrd, edge.tgtLen)
      const srcO = orientChar(edge.srcOrient)
      const tgtO = orientChar(edge.tgtOrient)
      gfaLinks.add(
        `L\t${canonicalLinkKey(srcOrd, srcO, edge.targetOrd, tgtO)}\t*`,
      )
    }
  }

  const refOrdSet = new Set(viewportRefOrds)
  const altOrds = [...allNodeOrds].filter(o => !refOrdSet.has(o))
  if (altOrds.length > 0) {
    const altEdgeMap = await getEdgesForOrdinals(edgeShard, altOrds)
    for (const [srcOrd, edges] of altEdgeMap) {
      for (const edge of edges) {
        if (allNodeOrds.has(edge.targetOrd)) {
          const srcO = orientChar(edge.srcOrient)
          const tgtO = orientChar(edge.tgtOrient)
          gfaLinks.add(
            `L\t${canonicalLinkKey(srcOrd, srcO, edge.targetOrd, tgtO)}\t*`,
          )
        }
      }
    }
  }

  const altSegs =
    altOrds.length > 0
      ? await fetchSegments(
          mergeOrdinalRanges(altOrds.map(o => [o, o] as [number, number])),
        )
      : []

  const subwalks = computePathSubwalks(
    [...seedSegments, ...altSegs],
    allNodeOrds,
  )

  const lines: string[] = ['H\tVN:Z:1.1']
  for (const ord of allNodeOrds) {
    const len = segLens.get(ord) ?? 0
    lines.push(`S\ts${ord}\t*\tLN:i:${len}`)
  }
  for (const link of gfaLinks) {
    lines.push(link)
  }
  for (const sw of subwalks) {
    const name = pathNames[sw.pathIdx]
    if (!name) {
      continue
    }
    const walk = sw.records
      .map(r => `s${r.segOrd}${orientChar(r.orient)}`)
      .join(',')
    lines.push(`P\t${name}\t${walk}\t*`)
  }

  return lines.join('\n')
}

interface Subwalk {
  pathIdx: number
  records: { segOrd: number; orient: number; offset: number; segLen: number }[]
}

// Walk each path's records in offset order, splitting at any gap where
// `next.offset !== prev.offset + prev.segLen`. Each contiguous run becomes
// one P-line — vg's xg-walk emission does the same: a re-entrant path
// produces multiple W-lines, not one with a discontinuous walk.
function computePathSubwalks(
  segs: SegRecord[],
  allNodeOrds: Set<number>,
): Subwalk[] {
  const seen = new Set<string>()
  const byPath = new Map<number, SegRecord[]>()
  for (const r of segs) {
    if (!allNodeOrds.has(r.segOrd)) {
      continue
    }
    const key = `${r.segOrd}|${r.pathNameIdx}|${r.offset}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    if (!byPath.has(r.pathNameIdx)) {
      byPath.set(r.pathNameIdx, [])
    }
    byPath.get(r.pathNameIdx)!.push(r)
  }

  const subwalks: Subwalk[] = []
  for (const [pathIdx, recs] of byPath) {
    recs.sort((a, b) => a.offset - b.offset)
    let current: Subwalk['records'] = []
    for (const r of recs) {
      const prev =
        current.length > 0 ? current[current.length - 1]! : undefined
      if (prev && r.offset !== prev.offset + prev.segLen) {
        subwalks.push({ pathIdx, records: current })
        current = []
      }
      current.push({
        segOrd: r.segOrd,
        orient: r.orient,
        offset: r.offset,
        segLen: r.segLen,
      })
    }
    if (current.length > 0) {
      subwalks.push({ pathIdx, records: current })
    }
  }
  return subwalks
}

export function buildGfaFromPathInference(
  refSegs: SegRecord[],
  refPathIdx: number,
  viewportRefOrds: number[],
  segLens: Map<number, number>,
  pathNames: string[],
) {
  const rawPathSegs = new Map<number, SegRecord[]>()
  for (const rec of refSegs) {
    if (!rawPathSegs.has(rec.pathNameIdx)) {
      rawPathSegs.set(rec.pathNameIdx, [])
    }
    rawPathSegs.get(rec.pathNameIdx)!.push(rec)
  }

  const refOrdSet = new Set(viewportRefOrds)
  const pathSegRecords = new Map<
    number,
    { segOrd: number; orient: number; offset: number }[]
  >()

  const refSegByOrd = new Map<number, SegRecord>()
  for (const rec of refSegs) {
    if (rec.pathNameIdx === refPathIdx) {
      refSegByOrd.set(rec.segOrd, rec)
    }
  }

  pathSegRecords.set(
    refPathIdx,
    viewportRefOrds.map(ord => {
      const rec = refSegByOrd.get(ord)!
      return { segOrd: ord, orient: rec.orient, offset: rec.offset }
    }),
  )

  for (const [pathIdx, records] of rawPathSegs) {
    if (pathIdx === refPathIdx) {
      continue
    }
    records.sort((a, b) => a.offset - b.offset)
    let firstShared = -1
    let lastShared = -1
    for (let i = 0; i < records.length; i++) {
      if (refOrdSet.has(records[i]!.segOrd)) {
        if (firstShared === -1) {
          firstShared = i
        }
        lastShared = i
      }
    }
    if (firstShared >= 0) {
      // Extend span to include adjacent alt segments that would
      // otherwise be lost (e.g. terminal variants). Walk backwards
      // from firstShared and forwards from lastShared, stopping at
      // the next ref segment or path boundary.
      let spanStart = firstShared
      while (spanStart > 0 && !refOrdSet.has(records[spanStart - 1]!.segOrd)) {
        spanStart--
      }
      let spanEnd = lastShared
      while (
        spanEnd < records.length - 1 &&
        !refOrdSet.has(records[spanEnd + 1]!.segOrd)
      ) {
        spanEnd++
      }

      const span: { segOrd: number; orient: number; offset: number }[] = []
      for (let i = spanStart; i <= spanEnd; i++) {
        const r = records[i]!
        segLens.set(r.segOrd, r.segLen)
        span.push({ segOrd: r.segOrd, orient: r.orient, offset: r.offset })
      }
      pathSegRecords.set(pathIdx, span)
    }
  }

  const links = new Set<string>()
  for (const sorted of pathSegRecords.values()) {
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!
      const b = sorted[i + 1]!
      const oA = orientChar(a.orient)
      const oB = orientChar(b.orient)
      links.add(`L\ts${a.segOrd}\t${oA}\ts${b.segOrd}\t${oB}\t*`)
    }
  }

  const lines: string[] = ['H\tVN:Z:1.1']
  for (const [ord, len] of segLens) {
    lines.push(`S\ts${ord}\t*\tLN:i:${len}`)
  }
  for (const link of links) {
    lines.push(link)
  }
  for (const [pathIdx, sorted] of pathSegRecords) {
    const pathName = pathNames[pathIdx]
    if (!pathName) {
      continue
    }
    const walk = sorted
      .map(s => `s${s.segOrd}${orientChar(s.orient)}`)
      .join(',')
    lines.push(`P\t${pathName}\t${walk}\t*`)
  }

  return lines.join('\n')
}
