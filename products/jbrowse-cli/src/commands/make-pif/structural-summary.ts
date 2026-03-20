import { computeSyriTypes } from './syri-classify.ts'

import type { SyriType } from './syri-classify.ts'

export interface AlignmentRecord {
  qname: string
  qlen: string
  qstart: number
  qend: number
  strand: string
  tname: string
  tlen: string
  tstart: number
  tend: number
  numMatches: number
  blockLen: number
}

export interface StructuralBlock {
  qname: string
  qlen: string
  qstart: number
  qend: number
  strand: string
  tname: string
  tlen: string
  tstart: number
  tend: number
  syriType: SyriType
  meanIdentity: number
}

export function mergeIntoStructuralBlocks(
  records: AlignmentRecord[],
  mergeGap: number,
): StructuralBlock[] {
  if (records.length === 0) {
    return []
  }

  const syriTypes = computeSyriTypes(
    records.map(r => ({
      qname: r.qname,
      qstart: r.qstart,
      qend: r.qend,
      tname: r.tname,
      tstart: r.tstart,
      tend: r.tend,
      strand: r.strand === '-' ? -1 : 1,
    })),
  )

  // Group by (target chromosome, query chromosome, syriType, strand)
  const groups = new Map<
    string,
    { rec: AlignmentRecord; syriType: SyriType }[]
  >()

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]!
    const st = syriTypes[i]!
    const key = `${rec.tname}\t${rec.qname}\t${st}\t${rec.strand}`
    let group = groups.get(key)
    if (!group) {
      group = []
      groups.set(key, group)
    }
    group.push({ rec, syriType: st })
  }

  const blocks: StructuralBlock[] = []

  for (const group of groups.values()) {
    // Sort by target start within each group
    group.sort((a, b) => a.rec.tstart - b.rec.tstart)

    let current = group[0]!
    let blockTStart = current.rec.tstart
    let blockTEnd = current.rec.tend
    let blockQStart = current.rec.qstart
    let blockQEnd = current.rec.qend
    let totalMatches = current.rec.numMatches
    let totalBlockLen = current.rec.blockLen

    for (let i = 1; i < group.length; i++) {
      const next = group[i]!
      if (next.rec.tstart - blockTEnd <= mergeGap) {
        // Merge
        blockTEnd = Math.max(blockTEnd, next.rec.tend)
        blockQStart = Math.min(blockQStart, next.rec.qstart)
        blockQEnd = Math.max(blockQEnd, next.rec.qend)
        totalMatches += next.rec.numMatches
        totalBlockLen += next.rec.blockLen
      } else {
        // Flush current block
        blocks.push({
          qname: current.rec.qname,
          qlen: current.rec.qlen,
          qstart: blockQStart,
          qend: blockQEnd,
          strand: current.rec.strand,
          tname: current.rec.tname,
          tlen: current.rec.tlen,
          tstart: blockTStart,
          tend: blockTEnd,
          syriType: current.syriType,
          meanIdentity: totalBlockLen > 0 ? totalMatches / totalBlockLen : 0,
        })

        current = next
        blockTStart = current.rec.tstart
        blockTEnd = current.rec.tend
        blockQStart = current.rec.qstart
        blockQEnd = current.rec.qend
        totalMatches = current.rec.numMatches
        totalBlockLen = current.rec.blockLen
      }
    }

    // Flush last block
    blocks.push({
      qname: current.rec.qname,
      qlen: current.rec.qlen,
      qstart: blockQStart,
      qend: blockQEnd,
      strand: current.rec.strand,
      tname: current.rec.tname,
      tlen: current.rec.tlen,
      tstart: blockTStart,
      tend: blockTEnd,
      syriType: current.syriType,
      meanIdentity: totalBlockLen > 0 ? totalMatches / totalBlockLen : 0,
    })
  }

  return blocks
}
