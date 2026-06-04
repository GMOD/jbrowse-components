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

// Human-readable phrasing for hover tooltips, expanding the terse UCSC MAF spec
// status characters into a plain-language explanation. Paren-free so the i-line
// "(N bp)" count can be appended without nesting parentheses.
const STATUS_DESCRIPTION: Record<MafStatus, string> = {
  C: 'contiguous — sequence here was deleted or could not be aligned',
  I: 'intervening non-aligning bases between the flanking blocks',
  N: 'alignment resumes on a new chromosome or scaffold',
  n: 'alignment resumes on a new chromosome or scaffold, bridged by a chain',
  M: 'missing data — unknown bases (Ns) in this region',
  T: 'tandem duplication — this region was used by an earlier block',
}

export function describeMafStatus(status: MafStatus): string {
  return STATUS_DESCRIPTION[status]
}
