import {
  getEdgesForOrdinals,
  mergeOrdinalRanges,
  orientChar,
} from './gfaBinaryIO.ts'
import {
  canonicalLinkKey,
  parsePanSn,
  walkOrient,
} from './gfaEmitHelpers.ts'

import type { IndexedBinaryShard, SegRecord } from './gfaBinaryIO.ts'

export type FetchSegmentsForOrdinals = (
  ranges: [number, number][],
) => Promise<SegRecord[]>

export type FetchSequencesForOrdinals = (
  ordinals: number[],
) => Promise<Map<number, Uint8Array>>

export interface BuildGfaOpts {
  // Cap the number of P/W lines emitted. If the computed subwalk count
  // exceeds this, drop all path emission and append a `# truncated paths:`
  // comment so consumers can detect the truncation. Used at megabase scale
  // where per-haplotype subwalk emission explodes (chr20 1 Mbp ≈ 219k
  // P-lines, 5 Mbp ≈ 434k) and the browser does not benefit from the
  // detail. Undefined = no truncation.
  maxPathsEmitted?: number
  // Number of edge-hops to expand from the seed viewport segments. Mirrors
  // `vg find -c k`. Default 1. 0 = seed only.
  context?: number
  // 'walks' emits W-lines (PanSN sample/hap/contig + walk offsets);
  // 'paths' emits P-lines. Default 'paths' for backward compatibility.
  emitFormat?: 'walks' | 'paths'
}

interface SubwalkRecord {
  segOrd: number
  orient: number
  offset: number
  segLen: number
}

interface Subwalk {
  pathIdx: number
  records: SubwalkRecord[]
}

const seqDecoder = new TextDecoder()

// Per GFA 1.1 spec the S-line sequence column is either an alphabet string
// or `*`; LN:i: is mandatory in the placeholder case so consumers can still
// allocate node lengths.
function formatSegLine(ord: number, len: number, seq: Uint8Array | undefined) {
  return seq
    ? `S\ts${ord}\t${seqDecoder.decode(seq)}`
    : `S\ts${ord}\t*\tLN:i:${len}`
}

function formatPathLine(name: string, records: SubwalkRecord[]) {
  const walk = records.map(r => `s${r.segOrd}${orientChar(r.orient)}`).join(',')
  return `P\t${name}\t${walk}\t*`
}

function formatWalkLine(name: string, records: SubwalkRecord[]) {
  const first = records[0]!
  const last = records[records.length - 1]!
  const start = first.offset
  const end = last.offset + last.segLen
  const walk = records.map(r => `${walkOrient(r.orient)}s${r.segOrd}`).join('')
  const { sample, hap, contig } = parsePanSn(name)
  return `W\t${sample}\t${hap}\t${contig}\t${start}\t${end}\t${walk}`
}

// Common GFA emitter shared by the edge-based and path-inference builders:
// emits the H header, then S lines (with optional sequences), then L lines,
// then either P or W lines per `emitFormat`. Truncates path emission with a
// comment line when subwalk count exceeds `maxPathsEmitted`.
async function assembleGfa(
  allNodeOrds: Iterable<number>,
  segLens: Map<number, number>,
  links: Iterable<string>,
  subwalks: Subwalk[],
  pathNames: string[],
  opts: BuildGfaOpts,
  fetchSequences: FetchSequencesForOrdinals | undefined,
) {
  const ords = [...allNodeOrds]
  const seqs = fetchSequences ? await fetchSequences(ords) : undefined

  const lines: string[] = ['H\tVN:Z:1.1']
  for (const ord of ords) {
    lines.push(formatSegLine(ord, segLens.get(ord) ?? 0, seqs?.get(ord)))
  }
  for (const link of links) {
    lines.push(link)
  }

  const cap = opts.maxPathsEmitted
  if (cap !== undefined && subwalks.length > cap) {
    lines.push(
      `# truncated paths: ${subwalks.length} (max emitted: ${cap}) — region too large for full path emission`,
    )
    return lines.join('\n')
  }

  const emitWalks = opts.emitFormat === 'walks'
  for (const sw of subwalks) {
    const name = pathNames[sw.pathIdx]
    if (!name) {
      continue
    }
    lines.push(
      emitWalks ? formatWalkLine(name, sw.records) : formatPathLine(name, sw.records),
    )
  }

  return lines.join('\n')
}

export async function buildGfaFromEdges(
  viewportRefOrds: number[],
  segLens: Map<number, number>,
  edgeShard: IndexedBinaryShard,
  fetchSegments: FetchSegmentsForOrdinals,
  pathNames: string[],
  seedSegments: SegRecord[],
  fetchSequences?: FetchSequencesForOrdinals,
  opts: BuildGfaOpts = {},
) {
  const context = opts.context ?? 1
  const allNodeOrds = new Set(viewportRefOrds)
  const gfaLinks = new Set<string>()

  const addLink = (
    srcOrd: number,
    srcOrient: number,
    tgtOrd: number,
    tgtOrient: number,
  ) => {
    gfaLinks.add(
      `L\t${canonicalLinkKey(`s${srcOrd}`, orientChar(srcOrient), `s${tgtOrd}`, orientChar(tgtOrient))}\t*`,
    )
  }

  // BFS k hops from the seed segments. context=0 skips expansion (seed-only);
  // context=1 matches `vg find -c 1`.
  let frontier = [...viewportRefOrds]
  for (let hop = 0; hop < context && frontier.length > 0; hop++) {
    const edgeMap = await getEdgesForOrdinals(edgeShard, frontier)
    const nextFrontier: number[] = []
    for (const [srcOrd, edges] of edgeMap) {
      for (const edge of edges) {
        addLink(srcOrd, edge.srcOrient, edge.targetOrd, edge.tgtOrient)
        if (!allNodeOrds.has(edge.targetOrd)) {
          allNodeOrds.add(edge.targetOrd)
          segLens.set(edge.targetOrd, edge.tgtLen)
          nextFrontier.push(edge.targetOrd)
        }
      }
    }
    frontier = nextFrontier
  }

  // Backfill cross-edges between non-seed nodes that the BFS didn't traverse
  // (a target's edge to another already-included node). Doesn't expand the
  // node set — only adds links among existing allNodeOrds.
  const refOrdSet = new Set(viewportRefOrds)
  const altOrds = [...allNodeOrds].filter(o => !refOrdSet.has(o))
  if (altOrds.length > 0) {
    const altEdgeMap = await getEdgesForOrdinals(edgeShard, altOrds)
    for (const [srcOrd, edges] of altEdgeMap) {
      for (const edge of edges) {
        if (allNodeOrds.has(edge.targetOrd)) {
          addLink(srcOrd, edge.srcOrient, edge.targetOrd, edge.tgtOrient)
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

  return assembleGfa(
    allNodeOrds,
    segLens,
    gfaLinks,
    subwalks,
    pathNames,
    opts,
    fetchSequences,
  )
}

// Walk each path's records in offset order, splitting at any gap where
// `next.offset !== prev.offset + prev.segLen`. Each contiguous run becomes
// one subwalk — vg's xg-walk emission does the same: a re-entrant path
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
    let current: SubwalkRecord[] = []
    for (const r of recs) {
      const prev = current.length > 0 ? current[current.length - 1]! : undefined
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

export async function buildGfaFromPathInference(
  refSegs: SegRecord[],
  refPathIdx: number,
  viewportRefOrds: number[],
  segLens: Map<number, number>,
  pathNames: string[],
  fetchSequences?: FetchSequencesForOrdinals,
  opts: BuildGfaOpts = {},
) {
  const refOrdSet = new Set(viewportRefOrds)
  const subwalks: Subwalk[] = []

  const refByOrd = new Map<number, SegRecord>()
  const rawPathSegs = new Map<number, SegRecord[]>()
  for (const rec of refSegs) {
    if (rec.pathNameIdx === refPathIdx) {
      refByOrd.set(rec.segOrd, rec)
    }
    if (!rawPathSegs.has(rec.pathNameIdx)) {
      rawPathSegs.set(rec.pathNameIdx, [])
    }
    rawPathSegs.get(rec.pathNameIdx)!.push(rec)
  }

  // Reference subwalk: viewport ords in order.
  subwalks.push({
    pathIdx: refPathIdx,
    records: viewportRefOrds.map(ord => {
      const rec = refByOrd.get(ord)!
      return {
        segOrd: ord,
        orient: rec.orient,
        offset: rec.offset,
        segLen: rec.segLen,
      }
    }),
  })

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
    if (firstShared < 0) {
      continue
    }

    // Extend span to include adjacent alt segments that would otherwise be
    // lost (e.g. terminal variants). Walk outward from the shared range,
    // stopping at the next ref segment or path boundary.
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

    const span: SubwalkRecord[] = []
    for (let i = spanStart; i <= spanEnd; i++) {
      const r = records[i]!
      segLens.set(r.segOrd, r.segLen)
      span.push({
        segOrd: r.segOrd,
        orient: r.orient,
        offset: r.offset,
        segLen: r.segLen,
      })
    }
    subwalks.push({ pathIdx, records: span })
  }

  // Infer L lines from path co-traversal: any two adjacent records in a
  // subwalk become an edge. canonicalLinkKey de-duplicates bidirected
  // partners so output matches the edge-based builder's link-set.
  const links = new Set<string>()
  for (const sw of subwalks) {
    for (let i = 0; i < sw.records.length - 1; i++) {
      const a = sw.records[i]!
      const b = sw.records[i + 1]!
      links.add(
        `L\t${canonicalLinkKey(`s${a.segOrd}`, orientChar(a.orient), `s${b.segOrd}`, orientChar(b.orient))}\t*`,
      )
    }
  }

  return assembleGfa(
    segLens.keys(),
    segLens,
    links,
    subwalks,
    pathNames,
    opts,
    fetchSequences,
  )
}
