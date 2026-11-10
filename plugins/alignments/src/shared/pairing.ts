import { isConcordantPairRead } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
  SAM_FLAG_UNMAPPED,
} from '@jbrowse/cigar-utils'

import type { Pairing } from './readFieldLevels.ts'

/**
 * Where one record stands in its pair (`PAIRING_LEVELS`), off its flags and
 * its `pairOrientationToNum`. A single-end record, a flagless synteny block and
 * a record that is itself unmapped are `unpaired`. A record whose mate is
 * unmapped is `discordant`, as `discordantBit` counts it.
 */
export function pairingOf(flags: number, pairOrientationNum: number): Pairing {
  if (flags & (SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY)) {
    return 'nonPrimary'
  }
  if (!(flags & SAM_FLAG_PAIRED) || flags & SAM_FLAG_UNMAPPED) {
    return 'unpaired'
  }
  return isConcordantPairRead(flags, pairOrientationNum)
    ? 'concordant'
    : 'discordant'
}
