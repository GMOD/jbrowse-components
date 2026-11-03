import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import {
  MISMATCH_OPACITY_FIELDS,
  MISMATCH_OPACITY_IMPLIED_FIELD,
  QUALITY_OPACITY_DOMAIN,
  QUALITY_OPACITY_RANGE,
} from '../features/mismatch/qualityOpacity.ts'
import { dropEmptyField } from '../shared/dropEmptyField.ts'

import type { MismatchOpacityField } from '../features/mismatch/qualityOpacity.ts'

/** `pileup.mismatches.encoding.opacity` as a config writes it. */
export type PileupMismatchesOpacitySnapshot =
  | MismatchOpacityField
  | number
  | {
      value?: number
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
 * The pileup's `mismatches.encoding.opacity`. Unset, each mismatched base
 * fades by its Phred base quality through a linear scale, by default from 0.1
 * at Q5 to opaque from Q20 up. A number is a constant opacity for every
 * mismatch, written to `value`: `1` draws them all opaque. A string is the
 * field. A base whose read carries no qualities draws opaque.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { mismatches: { encoding: { opacity: 1 } } },
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
     * #slot value
     * Every mismatch's opacity, 0 to 1, while no field fades them; a base
     * whose read carries no qualities still draws opaque. Writing
     * `opacity: 1` lands here.
     */
    value: {
      type: 'maybeNumber',
      description:
        "every mismatch's opacity; unset, with no field, fades by baseQuality",
    },
    /**
     * #slot field
     */
    field: {
      type: 'maybeStringEnum',
      model: types.enumeration('PileupMismatchesOpacityField', [
        ...MISMATCH_OPACITY_FIELDS,
      ]),
      description:
        'baseQuality fades each mismatched base by its Phred quality; unset follows value, and with neither written fades by baseQuality',
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
          defaultValue: QUALITY_OPACITY_RANGE.map(String),
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
    shorthand: ['value', 'field'],
    impliedField: MISMATCH_OPACITY_IMPLIED_FIELD,
    writes: 'whole',
    closed: true,
    plot: true,
    preProcessSnapshot: dropEmptyField,
  },
)
