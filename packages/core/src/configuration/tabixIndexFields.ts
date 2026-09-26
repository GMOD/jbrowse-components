import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import { fillIndexType } from './indexType.ts'

/**
 * The `index` sub-schema every tabix-indexed adapter declares: which index kind,
 * and where it is.
 *
 * The **snapshot** half of this was extracted first (`tabixIndexSnapshot`, whose
 * header explains why eight adapters writing out `CSI`/`TBI` and `.csi`/`.tbi`
 * separately is a crossed pair waiting to happen). This is the schema half of
 * the same job, and it was still nine hand-written copies under eight different
 * type names — `TabixIndex`, `Index`, `VcfIndex`, `Gff3TabixIndex`,
 * `GtfTabixIndex`, `BedGraphTabixIndex`, `PlinkLDTabixIndex` — for one concept,
 * which is what let four of them drift:
 *
 * - `MafTabixAdapter` omitted `locationType` from its default and declared its
 *   two slots in the opposite order
 * - `PairwiseIndexedPAFAdapter`'s prose said `<file>.pif.gz.tbi` while its
 *   default said `my.paf.gz.tbi`
 * - `PlinkLDTabixAdapter`'s description dropped a clause the other eight carried
 * - the placeholder extensions disagreed with each other for no reason
 *
 * The description is written for every tabix adapter rather than naming one
 * file type, since none of them is more canonical than the others and the
 * placeholder is not a value anyone copies — the `uri` shorthand derives the
 * real one.
 *
 * **BAM is deliberately not here.** Its index is BAI/CSI rather than TBI/CSI, so
 * it is a different enumeration with a different default, and folding the two
 * would mean a slot whose vocabulary depends on its adapter. `bamIndexFields`
 * is the same pair over that enumeration, and the two share `fillIndexType`.
 */
export const tabixIndexFields = {
  indexType: {
    model: types.enumeration('IndexType', ['TBI', 'CSI']),
    type: 'stringEnum',
    defaultValue: 'TBI',
    description:
      '`TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. Derived from the index file name where the config names a `.csi` and leaves this unset.',
  },
  location: {
    type: 'fileLocation',
    defaultValue: {
      uri: '/path/to/my.gz.tbi',
      locationType: 'UriLocation',
    },
    description:
      'location of the tabix index. Only needed when it is not named `<file>.tbi`, which is what the `uri` shorthand assumes — a `.csi` beside the file is reached with `csi: true` rather than by spelling this out.',
  },
} as const

/**
 * #config TabixIndex
 * #category adapter
 * The `index` every tabix-indexed adapter hangs off itself: where the index is,
 * and which of the two kinds it is. `indexType` is derived from the index file's
 * own name where the config names a `.csi` and leaves it unset, so the usual
 * config states neither — the `uri` shorthand derives both, and `csi: true`
 * beside it switches the pair together. Spell `location` out for an index that
 * does not sit beside its data file; a `.csi` named there is read as a CSI
 * without `indexType` as well.
 */
export function tabixIndexSchema() {
  return ConfigurationSchema(
    'TabixIndex',
    { ...tabixIndexFields },
    { preProcessSnapshot: fillIndexType },
  )
}
