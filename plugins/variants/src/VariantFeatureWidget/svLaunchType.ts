import { svClassOfAlt } from '@jbrowse/core/util/svAlt'

import type { VCFFeatureSerialized } from './types.ts'

// SO-term substrings that mark a variant as structural enough to warrant the SV
// launch panel. Matched as substrings of the feature's `type` (e.g.
// 'copy_number' catches 'copy_number_variation', 'duplication' catches
// 'tandem_duplication'). Breakend/translocation/paired variants are handled by
// their own branches before this check. An insertion is absent on purpose: the
// panel zooms to the span the record covers, which is one base for an insertion.
const svTypes = ['inversion', 'deletion', 'duplication', 'copy_number', 'sv']

export function isSvLaunchType(type: string) {
  return svTypes.some(t => type.includes(t))
}

// The SO term alone calls a 2 bp `ATG -> A` a deletion; a structural variant is
// a symbolic or declared SV allele, or a sequence allele 50 bp or more from REF.
export function isSvLaunchFeature({
  type = '',
  REF,
  ALT = [],
  INFO,
}: Pick<VCFFeatureSerialized, 'type' | 'REF' | 'ALT' | 'INFO'>) {
  return (
    isSvLaunchType(type) &&
    (ALT.length === 0 ||
      ALT.some(
        (alt, alleleIndex) =>
          svClassOfAlt(alt, { ref: REF, info: INFO, alleleIndex }) !== '',
      ))
  )
}
