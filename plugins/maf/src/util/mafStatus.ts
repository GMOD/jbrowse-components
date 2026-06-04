import type { MafStatus } from '../types.ts'

// Cast-free lookup: returns the MafStatus for a recognized character, else
// undefined for malformed/absent input.
const STATUS_BY_CHAR: Record<string, MafStatus> = {
  C: 'C',
  I: 'I',
  N: 'N',
  n: 'n',
  M: 'M',
  T: 'T',
}

export function toMafStatus(s: string | undefined): MafStatus | undefined {
  return s ? STATUS_BY_CHAR[s] : undefined
}

// Human-readable phrasing for hover tooltips, mirroring the UCSC MAF spec
// descriptions of the i/e line status characters.
const STATUS_DESCRIPTION: Record<MafStatus, string> = {
  C: 'contiguous',
  I: 'intervening bases',
  N: 'new contig',
  n: 'new contig (bridged)',
  M: 'missing data (Ns)',
  T: 'tandem duplication',
}

export function describeMafStatus(status: MafStatus): string {
  return STATUS_DESCRIPTION[status]
}
