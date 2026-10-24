import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import {
  MISMATCH_OPACITY_FIELDS,
  QUALITY_OPACITY_DOMAIN,
} from '../features/mismatch/qualityOpacity.ts'
import { dropEmptyField } from '../shared/dropEmptyField.ts'

import type { MismatchOpacityField } from '../features/mismatch/qualityOpacity.ts'

/** `pileup.mismatches.encoding.opacity` as a config writes it. */
export type PileupMismatchesOpacitySnapshot =
  | MismatchOpacityField
  | {
      field?: MismatchOpacityField
      scale?: {
        domainMin?: number
        domainMax?: number
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
 *           scale: { domainMin: 0, domainMax: 30, range: [0.2, 1] },
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
      type: 'maybeStringEnum',
      model: types.enumeration('PileupMismatchesOpacityField', [
        ...MISMATCH_OPACITY_FIELDS,
      ]),
      description:
        'baseQuality fades each mismatched base by its Phred quality; unset draws them opaque',
    },
    /**
     * #slot scale
     * How a base quality maps to an opacity.
     */
    scale: ConfigurationSchema(
      'PileupMismatchesOpacityScale',
      {
        /**
         * #slot scale.domainMin
         */
        domainMin: {
          type: 'number',
          defaultValue: QUALITY_OPACITY_DOMAIN[0],
          description:
            'the Phred quality that takes the first opacity in range',
        },
        /**
         * #slot scale.domainMax
         */
        domainMax: {
          type: 'number',
          defaultValue: QUALITY_OPACITY_DOMAIN[1],
          description: 'the Phred quality that takes the last opacity in range',
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
        // the range is written as the numbers it names and held as strings,
        // the way a threshold domain holds its cuts
        preProcessSnapshot: (snap: Record<string, unknown> = {}) => ({
          ...snap,
          ...(Array.isArray(snap.range)
            ? { range: snap.range.map(String) }
            : {}),
        }),
      },
    ),
  },
  {
    shorthand: 'field',
    writes: 'whole',
    closed: true,
    plot: true,
    preProcessSnapshot: dropEmptyField,
  },
)
