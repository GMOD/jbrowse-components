import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorChannelOptions,
  colorChannelSlots,
  colorDomainEndsSlots,
  colorDomainSlot,
  colorRampSlots,
  colorRangeSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

import { ALIGNMENTS_COLOR_SCALES } from '../shared/alignmentsColor.ts'

/**
 * #config AlignmentsColor
 * #category display
 * The alignments displays' `color` setting: one colour for every read, or a
 * field each read carries. A read dimension paints its own vocabulary
 * (`strand`, `firstOfPairStrand`, `pairOrientation`, `insertSize`,
 * `insertSizeAndOrientation`, `mateRefName`) or ramp (`mapq`), `tags.XX` reads
 * a SAM tag and any other name a feature attribute. A string is the constant.
 * The per-base layer over the reads is
 * [AlignmentsBaseColor](../alignmentsbasecolor).
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', color: { field: 'strand' } }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   color: { field: 'tags.HP', domain: ['1', '2'], range: ['#d95f02', '#1b9e77'] },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   color: { field: 'tags.NM', scale: 'linear', scheme: 'viridis' },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   color: { field: 'insertSize', domain: ['150', '600'] },
 * }
 * ```
 */
export const alignmentsColorConfigSchema = ConfigurationSchema(
  'AlignmentsColor',
  {
    /**
     * #slot value
     * The fill of every read while no field paints, and of a read carrying no
     * value under a tag or attribute. Writing `color: "steelblue"` lands here.
     * Unset, the theme's read colour.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS colour of a read no field paints',
    },
    ...colorChannelSlots({
      scales: ALIGNMENTS_COLOR_SCALES,
      scaleName: 'AlignmentsColorScale',
      fieldType: 'string',
      field:
        'what colours a read: strand, firstOfPairStrand, pairOrientation, insertSize, insertSizeAndOrientation, mateRefName and mapq paint their own vocabulary or ramp; tags.XX reads a SAM tag and any other name a feature attribute',
      scale:
        'none paints value and keeps the field for a switch back; categorical a range colour per value; linear a ramp over a numeric tag or attribute between domainMin and domainMax; threshold the bins domain cuts; unset, threshold over insertSize and insertSizeAndOrientation and categorical over any other field',
    }),
    ...colorDomainSlot({
      domain:
        'for a categorical scale, the values that take the range first, in order; for a threshold scale, the cut points, which over insertSize are the two between short, normal and long, where the sampled distribution otherwise sets them',
    }),
    ...colorDomainEndsSlots,
    ...colorRangeSlot({
      range:
        "CSS colours a categorical scale hands its domain in order, a threshold scale its bins, or a linear scale's stops, evenly spaced; empty is the tag palette or viridis",
    }),
    ...colorRampSlots,
  },
  colorChannelOptions('color'),
)
