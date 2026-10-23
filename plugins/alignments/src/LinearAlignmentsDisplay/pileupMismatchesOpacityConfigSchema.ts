import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { MISMATCH_OPACITY_FIELDS } from '../features/mismatch/qualityOpacity.ts'

import type { MismatchOpacityField } from '../features/mismatch/qualityOpacity.ts'

/** `pileup.mismatches.encoding.opacity` as a config writes it. */
export type PileupMismatchesOpacitySnapshot =
  | MismatchOpacityField
  | {
      field?: MismatchOpacityField
      scale?: {
        domain?: readonly (number | string)[]
        range?: readonly (number | string)[]
        clamp?: boolean
      }
    }

/**
 * #config PileupMismatchesOpacity
 * #category display
 * The pileup's `mismatches.encoding.opacity`: unset, every mismatched base
 * draws opaque; `baseQuality` fades each one by its Phred base quality
 * through a linear scale, by default from transparent at 0 to opaque from 50
 * up. A string is the field. A base whose read carries no qualities draws
 * opaque.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { mismatches: { encoding: { opacity: 'baseQuality' } } },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: {
 *     mismatches: {
 *       encoding: {
 *         opacity: {
 *           field: 'baseQuality',
 *           scale: { domain: [0, 30], range: [0.2, 1] },
 *         },
 *       },
 *     },
 *   },
 * }
 * ```
 */
export const pileupMismatchesOpacityConfigSchema = ConfigurationSchema(
  'PileupMismatchesOpacity',
  {
    /**
     * #slot field
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('PileupMismatchesOpacityField', [
        ...MISMATCH_OPACITY_FIELDS,
      ]),
      defaultValue: '',
      description:
        'baseQuality fades each mismatched base by its Phred quality; empty draws them opaque',
    },
    /**
     * #slot scale
     * How a base quality maps to an opacity.
     */
    scale: ConfigurationSchema(
      'PileupMismatchesOpacityScale',
      {
        /**
         * #slot scale.domain
         */
        domain: {
          type: 'stringArray',
          defaultValue: ['0', '50'],
          description:
            'the Phred qualities that take the first and the last opacity in range',
        },
        /**
         * #slot scale.range
         */
        range: {
          type: 'stringArray',
          defaultValue: ['0', '1'],
          description: 'the opacities, 0 to 1, at the two ends of the domain',
        },
        /**
         * #slot scale.clamp
         */
        clamp: {
          type: 'boolean',
          defaultValue: true,
          description:
            'a quality past the domain takes the nearer end of the range; off, the line runs on until the base is fully opaque or gone',
        },
      },
      {
        closed: true,
        // the domain and range are written as the numbers they name and held
        // as strings, the way a threshold domain holds its cuts
        preProcessSnapshot: (snap: Record<string, unknown> = {}) => ({
          ...snap,
          ...(Array.isArray(snap.domain)
            ? { domain: snap.domain.map(String) }
            : {}),
          ...(Array.isArray(snap.range)
            ? { range: snap.range.map(String) }
            : {}),
        }),
      },
    ),
  },
  { shorthand: 'field', writes: 'whole', closed: true, plot: true },
)
