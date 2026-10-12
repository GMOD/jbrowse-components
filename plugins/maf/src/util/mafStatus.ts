import type { MafStatus } from '../types.ts'

/**
 * The wire encoding of a `MafStatus`: its 1-based index here, with 0 meaning
 * absent. Statuses travel as `Uint8Array` columns in `MafWireRegionData`, so
 * they need a numeric form and a reserved "no status" value.
 *
 * An index rather than the ASCII code so the round trip stays cast-free —
 * `MAF_STATUS_WIRE[code - 1]` is already typed `MafStatus | undefined`, where
 * `String.fromCharCode(...) as MafStatus` would be an assertion that a
 * corrupted byte could violate.
 */
export const MAF_STATUS_WIRE: readonly MafStatus[] = [
  'C',
  'I',
  'N',
  'n',
  'M',
  'T',
]

const STATUS_BY_CHAR = new Map<string, MafStatus>(
  MAF_STATUS_WIRE.map(status => [status, status]),
)

/** The status a character names, or undefined for one MAF does not define. */
export function toMafStatus(s: string | undefined) {
  return s === undefined ? undefined : STATUS_BY_CHAR.get(s)
}

export function encodeMafStatus(status: MafStatus | undefined) {
  return status === undefined ? 0 : MAF_STATUS_WIRE.indexOf(status) + 1
}

export function decodeMafStatus(code: number): MafStatus | undefined {
  return code === 0 ? undefined : MAF_STATUS_WIRE[code - 1]
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
