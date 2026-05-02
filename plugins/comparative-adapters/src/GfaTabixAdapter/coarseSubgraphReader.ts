export interface CoarseRow {
  refStart: number
  refEnd: number
  superOrd: number
}

export function parseCoarseLine(line: string): CoarseRow | null {
  if (line.startsWith('#')) {
    return null
  }
  const t1 = line.indexOf('\t')
  const t2 = line.indexOf('\t', t1 + 1)
  const t3 = line.indexOf('\t', t2 + 1)
  if (t1 < 0 || t2 < 0 || t3 < 0) {
    return null
  }
  return {
    refStart: +line.slice(t1 + 1, t2),
    refEnd: +line.slice(t2 + 1, t3),
    superOrd: +line.slice(t3 + 1, line.indexOf('\t', t3 + 1)),
  }
}

export function coarseRowsToGfa(rows: CoarseRow[]): string {
  const lines = ['H\tVN:Z:1.1']
  for (const { superOrd, refStart, refEnd } of rows) {
    lines.push(`S\t${superOrd}\t*\tLN:i:${refEnd - refStart}`)
  }
  return lines.join('\n')
}
