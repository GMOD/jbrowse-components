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

export interface MergedBlock {
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

// Gap-merge alignment records grouped by (tname, qname, strand). Within a
// group, sort by tstart and collapse consecutive records whose tstart gap
// is <= mergeGap into a single block. numMatches / blockLen are summed so
// the consumer can recompute identity as numMatches / blockLen.
export function mergeIntoBlocks(
  records: AlignmentRecord[],
  mergeGap: number,
): MergedBlock[] {
  if (records.length === 0) {
    return []
  }
  const groups = new Map<string, AlignmentRecord[]>()
  for (const rec of records) {
    const key = `${rec.tname}\t${rec.qname}\t${rec.strand}`
    let group = groups.get(key)
    if (!group) {
      group = []
      groups.set(key, group)
    }
    group.push(rec)
  }

  const blocks: MergedBlock[] = []
  for (const group of groups.values()) {
    group.sort((a, b) => a.tstart - b.tstart)
    let current = group[0]!
    let blockTStart = current.tstart
    let blockTEnd = current.tend
    let blockQStart = current.qstart
    let blockQEnd = current.qend
    let totalMatches = current.numMatches
    let totalBlockLen = current.blockLen

    for (let i = 1; i < group.length; i++) {
      const next = group[i]!
      if (next.tstart - blockTEnd <= mergeGap) {
        blockTEnd = Math.max(blockTEnd, next.tend)
        blockQStart = Math.min(blockQStart, next.qstart)
        blockQEnd = Math.max(blockQEnd, next.qend)
        totalMatches += next.numMatches
        totalBlockLen += next.blockLen
      } else {
        blocks.push({
          qname: current.qname,
          qlen: current.qlen,
          qstart: blockQStart,
          qend: blockQEnd,
          strand: current.strand,
          tname: current.tname,
          tlen: current.tlen,
          tstart: blockTStart,
          tend: blockTEnd,
          numMatches: totalMatches,
          blockLen: totalBlockLen,
        })
        current = next
        blockTStart = current.tstart
        blockTEnd = current.tend
        blockQStart = current.qstart
        blockQEnd = current.qend
        totalMatches = current.numMatches
        totalBlockLen = current.blockLen
      }
    }
    blocks.push({
      qname: current.qname,
      qlen: current.qlen,
      qstart: blockQStart,
      qend: blockQEnd,
      strand: current.strand,
      tname: current.tname,
      tlen: current.tlen,
      tstart: blockTStart,
      tend: blockTEnd,
      numMatches: totalMatches,
      blockLen: totalBlockLen,
    })
  }
  return blocks
}
