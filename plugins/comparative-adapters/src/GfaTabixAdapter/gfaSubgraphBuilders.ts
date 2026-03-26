import { ORIENT_FWD, getEdgesForOrdinals } from './gfaBinaryIO.ts'

import type { IndexedBinaryShard, SegRecord } from './gfaBinaryIO.ts'

export async function buildGfaFromEdges(
  viewportRefOrds: number[],
  segLens: Map<number, number>,
  edgeShard: IndexedBinaryShard,
) {
  const edgeMap = await getEdgesForOrdinals(edgeShard, viewportRefOrds)
  const allNodeOrds = new Set(viewportRefOrds)
  const gfaLinks = new Set<string>()

  for (const [srcOrd, edges] of edgeMap) {
    for (const edge of edges) {
      allNodeOrds.add(edge.targetOrd)
      segLens.set(edge.targetOrd, edge.tgtLen)
      const srcO = edge.srcOrient === ORIENT_FWD ? '+' : '-'
      const tgtO = edge.tgtOrient === ORIENT_FWD ? '+' : '-'
      gfaLinks.add(`L\ts${srcOrd}\t${srcO}\ts${edge.targetOrd}\t${tgtO}\t*`)
    }
  }

  const refOrdSet = new Set(viewportRefOrds)
  const altOrds = [...allNodeOrds].filter(o => !refOrdSet.has(o))
  if (altOrds.length > 0) {
    const altEdgeMap = await getEdgesForOrdinals(edgeShard, altOrds)
    for (const [srcOrd, edges] of altEdgeMap) {
      for (const edge of edges) {
        if (allNodeOrds.has(edge.targetOrd)) {
          const srcO = edge.srcOrient === ORIENT_FWD ? '+' : '-'
          const tgtO = edge.tgtOrient === ORIENT_FWD ? '+' : '-'
          gfaLinks.add(`L\ts${srcOrd}\t${srcO}\ts${edge.targetOrd}\t${tgtO}\t*`)
        }
      }
    }
  }

  const lines: string[] = ['H\tVN:Z:1.1']
  for (const ord of allNodeOrds) {
    const len = segLens.get(ord) ?? 0
    lines.push(`S\ts${ord}\t*\tLN:i:${len}`)
  }
  for (const link of gfaLinks) {
    lines.push(link)
  }

  return lines.join('\n')
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
      const span: { segOrd: number; orient: number; offset: number }[] = []
      for (let i = firstShared; i <= lastShared; i++) {
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
      const oA = a.orient === ORIENT_FWD ? '+' : '-'
      const oB = b.orient === ORIENT_FWD ? '+' : '-'
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
      .map(s => `s${s.segOrd}${s.orient === ORIENT_FWD ? '+' : '-'}`)
      .join(',')
    lines.push(`P\t${pathName}\t${walk}\t*`)
  }

  return lines.join('\n')
}
