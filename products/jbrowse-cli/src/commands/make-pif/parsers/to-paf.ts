import type { PAFLikeRecord } from './syri-parser.ts'

// Converts PAFLikeRecord array to PAF format lines (tab-delimited strings)
export function recordsToPafLines(records: PAFLikeRecord[]): string[] {
  return records.map(r => {
    const cols = [
      r.qname,
      r.qlen,
      String(r.qstart),
      String(r.qend),
      r.strand,
      r.tname,
      r.tlen,
      String(r.tstart),
      String(r.tend),
      String(r.numMatches),
      String(r.blockLen),
      '255',
    ]
    if (r.cigar) {
      cols.push(`cg:Z:${r.cigar}`)
    }
    if (r.segmentId) {
      cols.push(`sg:Z:${r.segmentId}`)
    }
    return cols.join('\t')
  })
}
