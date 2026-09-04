import { types } from '@jbrowse/mobx-state-tree'

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
 * would mean a slot whose vocabulary depends on its adapter.
 */
export const tabixIndexFields = {
  indexType: {
    model: types.enumeration('IndexType', ['TBI', 'CSI']),
    type: 'stringEnum',
    defaultValue: 'TBI',
    description:
      '`TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address.',
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
