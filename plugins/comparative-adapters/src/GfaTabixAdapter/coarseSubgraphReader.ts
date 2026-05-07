export interface CoarseRow {
  refStart: number
  refEnd: number
  superOrd: number
  type: string
  hapCount: number
}

// Handles both v1 (6 cols) and v2 (7 cols) schemas.
// v1: chrom start end superOrd type constituentOrds
// v2: chrom start end superOrd type hap_count constituentOrds
export function parseCoarseLine(line: string): CoarseRow | null {
  if (line.startsWith('#')) {
    return null
  }
  const t1 = line.indexOf('\t')
  const t2 = line.indexOf('\t', t1 + 1)
  const t3 = line.indexOf('\t', t2 + 1)
  const t4 = line.indexOf('\t', t3 + 1)
  const t5 = line.indexOf('\t', t4 + 1)
  if (t1 < 0 || t2 < 0 || t3 < 0 || t4 < 0 || t5 === -1) {
    return null
  }
  const type = line.slice(t4 + 1, t5)
  // Detect v2: col5 is a pure non-negative integer (hap_count).
  // v1 col5 is constituentOrds which always contains '-' or ','.
  const t6 = line.indexOf('\t', t5 + 1)
  const col5 = line.slice(t5 + 1, t6 > 0 ? t6 : undefined)
  const isV2 = /^\d+$/.test(col5)
  const hapCount = isV2 ? +col5 : 0
  return {
    refStart: +line.slice(t1 + 1, t2),
    refEnd: +line.slice(t2 + 1, t3),
    superOrd: +line.slice(t3 + 1, t4),
    type,
    hapCount,
  }
}

export function coarseRowsToGfa(rows: CoarseRow[]): string {
  const lines = ['H\tVN:Z:1.1']
  for (const { superOrd, refStart, refEnd, type, hapCount } of rows) {
    const tags = [`LN:i:${refEnd - refStart}`, `tp:Z:${type}`]
    if (hapCount > 0) {
      tags.push(`hc:i:${hapCount}`)
    }
    lines.push(`S\t${superOrd}\t*\t${tags.join('\t')}`)
  }
  return lines.join('\n')
}
