import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { MODIFICATION_UNMODIFIED } from '../shared/types.ts'

import type { CytosineContext } from '@jbrowse/modifications-utils'

// Spelled out so the slot's type is the literal union and not the alias: a
// display in another plugin composing this schema cannot name the alias in its
// declaration emit without a dependency of its own on modifications-utils.
const CYTOSINE_CONTEXTS = [
  'CG',
  'CHG',
  'CHH',
  'all',
] as const satisfies readonly CytosineContext[]

/**
 * #config AlignmentsModifications
 * #category display
 * The alignments displays' `modifications` setting: what the `modifications`
 * and `bisulfite` fields of [AlignmentsBaseColor](../alignmentsbasecolor)
 * draw. The by-type view paints each MM/ML call its type's color above
 * `threshold`; `unmodified: 'calls'` paints the unmodified side blue as well,
 * and `unmodified: 'all'` paints every cytosine in `cytosineContext` whether
 * the basecaller listed it or not, which is the methylation view.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   baseColor: 'modifications',
 *   modifications: { unmodified: 'all', cytosineContext: 'CHG' },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   baseColor: 'modifications',
 *   modifications: { shownModifications: ['a'], threshold: 50 },
 * }
 * ```
 */
export const alignmentsModificationsConfigSchema = ConfigurationSchema(
  'AlignmentsModifications',
  {
    /**
     * #slot
     */
    threshold: {
      type: 'number',
      defaultValue: 10,
      description:
        'hide a call whose probability is under this percent in the by-type view; the two-color view cuts at 50 and the methylation fill paints every cytosine',
    },
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
        "which unmodified sites paint blue: 'hidden' none, 'calls' the calls more likely unmodified, under modifications and bisulfite alike, and 'all' every cytosine in the context as well, the ones the basecaller left implicit included; 'all' is the methylation view",
    },
    /**
     * #slot
     */
    cytosineContext: {
      type: 'stringEnum',
      model: types.enumeration('CytosineContext', [...CYTOSINE_CONTEXTS]),
      defaultValue: 'CG',
      description:
        'which cytosines the methylation fill and bisulfite paint: CG, CHG, CHH or all',
    },
    /**
     * #slot
     */
    shownModifications: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'the modification type codes drawn (m, h, a, ...); empty draws every type the reads carry',
    },
  },
  { closed: true },
)
