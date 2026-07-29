import { getLengthOnRef } from '@jbrowse/alignments-core'
import { toLocale } from '@jbrowse/core/util'

import { formatLocationRange, toNavLocString } from '../shared/locStrings.ts'

export interface ParsedSupplementaryAlignment {
  locString: string
  label: string
}

// Fraction of the alignment's length padded onto each side of the navigated
// range, so the landed view frames the segment instead of butting against it.
const PAD_FRACTION = 5

// Parses one `;`-delimited SA-tag record (rname,pos,strand,CIGAR,mapQ,NM) into a
// navigable locstring plus a human-readable label. Returns undefined when the
// record is missing a required field.
//
// SA positions are 1-based, so the record converts to the same 0-based half-open
// interval `featurizeSA` builds for it before being formatted. Formatting the
// raw 1-based start made the label claim one base more than the alignment covers
// (a 100M record read as "1,000-1,100").
export function parseSupplementaryAlignment(
  record: string,
): ParsedSupplementaryAlignment | undefined {
  const [saRef, saStart, saStrand, saCigar, saMapq, saNm] = record.split(',')
  if (!saRef || !saStart || !saStrand || !saCigar) {
    return undefined
  }
  const length = getLengthOnRef(saCigar)
  const start = +saStart - 1
  const end = start + length
  const mapq = saMapq ? ` MAPQ:${saMapq}` : ''
  const nm = saNm ? ` NM:${saNm}` : ''
  return {
    locString: toNavLocString(
      saRef,
      start,
      end,
      Math.floor(length / PAD_FRACTION),
    ),
    label: `${formatLocationRange(saRef, start, end)} (${saStrand}) [${toLocale(length)}bp]${mapq}${nm}`,
  }
}
