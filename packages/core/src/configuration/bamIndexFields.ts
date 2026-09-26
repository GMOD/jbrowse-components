import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import { fillIndexType } from './indexType.ts'

/**
 * BAM's `index`, which is the tabix pair over a different enumeration: BAI/CSI
 * rather than TBI/CSI, with its own default and its own placeholder name.
 * Folding the two would mean a slot whose vocabulary depends on its adapter,
 * which is why `tabixIndexFields` says BAM is deliberately not there.
 *
 * Only the enumeration differs. `fillIndexType` is the same function, since a
 * `.csi` names itself the same way whichever sibling format it stands in for.
 */
export const bamIndexFields = {
  indexType: {
    model: types.enumeration('IndexType', ['BAI', 'CSI']),
    type: 'stringEnum',
    defaultValue: 'BAI',
    description:
      '`BAI` is the usual `samtools index` output. `CSI` is required for a reference longer than 512 Mb, which BAI cannot address. Derived from the index file name where the config names a `.csi` and leaves this unset.',
  },
  location: {
    type: 'fileLocation',
    defaultValue: {
      uri: '/path/to/my.bam.bai',
      locationType: 'UriLocation',
    },
    description:
      'location of the index. Only needed when it is not named `<file>.bam.bai` (or `.bam.csi`), the names the `uri` shorthand assumes.',
  },
} as const

/**
 * #config BamIndex
 * #category adapter
 * Where a BAM's index is and which of the two kinds it is. `indexType` is
 * derived from the index file's own name where the config names a `.csi` and
 * leaves it unset, so the usual config states neither — the `uri` shorthand
 * derives both, and `csi: true` beside it switches the pair together. Spell
 * `location` out for an index that does not sit beside its BAM; a `.csi` named
 * there is read as a CSI without `indexType` as well.
 */
export function bamIndexSchema() {
  return ConfigurationSchema(
    'BamIndex',
    { ...bamIndexFields },
    { preProcessSnapshot: fillIndexType },
  )
}
