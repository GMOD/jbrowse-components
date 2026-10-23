import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { MODIFICATION_UNMODIFIED } from '../shared/types.ts'

/**
 * #config AlignmentsModifications
 * #category display
 * The alignments displays' `modifications` setting configures the
 * `modifications` and `bisulfite` fields of
 * [AlignmentsBaseColor](../alignmentsbasecolor): `unmodified: 'calls'` paints
 * the unmodified side blue as well, and `unmodified: 'all'` paints every
 * cytosine in the `pileup.bases.filter` context whether the basecaller listed
 * it or not, which is the methylation view. Which calls draw is
 * `pileup.bases.filter`'s.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: {
 *     bases: {
 *       show: true,
 *       encoding: { color: 'modifications' },
 *       filter: [{ field: 'context', oneOf: ['CHG'] }],
 *     },
 *   },
 *   modifications: { unmodified: 'all' },
 * }
 * ```
 */
export const alignmentsModificationsConfigSchema = ConfigurationSchema(
  'AlignmentsModifications',
  {
    /**
     * #slot
     */
    unmodified: {
      type: 'stringEnum',
      model: types.enumeration('ModificationUnmodified', [
        ...MODIFICATION_UNMODIFIED,
      ]),
      defaultValue: 'hidden',
      description:
        "unmodified sites painted blue: 'hidden' none, 'calls' the calls more likely unmodified, under modifications and bisulfite alike, and 'all' every cytosine in the context as well, the ones the basecaller left implicit included; 'all' is the methylation view",
    },
  },
  { closed: true, plot: true },
)
