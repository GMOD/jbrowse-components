import { getLengthOnRef } from '@jbrowse/alignments-core'
import { toLocale } from '@jbrowse/core/util'

export interface ParsedSupplementaryAlignment {
  locString: string
  label: string
}

// Parses one `;`-delimited SA-tag record (rname,pos,strand,CIGAR,mapQ,NM) into a
// navigable locstring plus a human-readable label. The locstring is padded by a
// fifth of the alignment length on each side so the landed view frames the read.
// Returns undefined when the record is missing a required field.
export function parseSupplementaryAlignment(
  record: string,
): ParsedSupplementaryAlignment | undefined {
  const [saRef, saStart, saStrand, saCigar, saMapq, saNm] = record.split(',')
  if (!saRef || !saStart || !saStrand || !saCigar) {
    return undefined
  }
  const length = getLengthOnRef(saCigar)
  const pad = Math.floor(length / 5)
  const start = +saStart
  const end = start + length
  const mapq = saMapq ? ` MAPQ:${saMapq}` : ''
  const nm = saNm ? ` NM:${saNm}` : ''
  return {
    locString: `${saRef}:${Math.max(1, start - pad)}-${end + pad}`,
    label: `${saRef}:${toLocale(start)}-${toLocale(end)} (${saStrand}) [${toLocale(length)}bp]${mapq}${nm}`,
  }
}
