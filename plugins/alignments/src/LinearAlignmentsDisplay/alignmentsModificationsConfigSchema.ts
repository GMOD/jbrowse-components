import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

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
 * draw. The by-type view paints each MM/ML call its type's colour above
 * `threshold`; `twoColor` paints the unmodified side blue as well, and
 * `fillUnmarked` paints every cytosine in `cytosineContext` whether the
 * basecaller listed it or not, which is the methylation view.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   baseColor: 'modifications',
 *   modifications: { fillUnmarked: true, cytosineContext: 'CHG' },
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
        'hide a call whose probability is under this percent in the by-type view; the two-colour view cuts at 50 and the methylation fill paints every cytosine',
    },
    /**
     * #slot
     */
    twoColor: {
      type: 'boolean',
      defaultValue: false,
      description:
        'paint the unmodified side blue as well as the modified side its colour, under modifications and bisulfite alike',
    },
    /**
     * #slot
     */
    fillUnmarked: {
      type: 'boolean',
      defaultValue: false,
      description:
        'paint every cytosine in the context as methylated or unmethylated, the ones the basecaller left implicit included; the methylation view',
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
