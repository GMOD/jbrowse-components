import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorChannelOptions,
  colorChannelSlots,
  colorPaletteSlot,
  colorRampSlot,
} from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

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
 *   color: { field: 'tags.HP', domain: ['1', '2'], palette: ['#d95f02', '#1b9e77'] },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   color: { field: 'tags.NM', scale: 'linear', ramp: ['viridis'] },
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
      field:
        'what colours a read: strand, firstOfPairStrand, pairOrientation, insertSize, insertSizeAndOrientation, mateRefName and mapq paint their own vocabulary or ramp; tags.XX reads a SAM tag and any other name a feature attribute',
      scale:
        'none paints value and keeps the field for a switch back; categorical a palette colour per value; linear a ramp over a numeric tag or attribute; threshold the bins domain cuts; unset follows field',
      domain:
        "the values that take the palette first, in order; under insertSize the two cut points between short, normal and long, where the sampled distribution otherwise sets them; under linear the ramp's two ends, where the loaded reads otherwise set them",
    }),
    ...colorPaletteSlot,
    ...colorRampSlot,
  },
  colorChannelOptions('color'),
)

/**
 * #config AlignmentsBaseColor
 * #category display
 * The alignments displays' `baseColor` setting: the per-base variable painted
 * as a cell per base over the reads, whatever `color` fills them with.
 * `modifications` paints the MM/ML calls and `bisulfite` the conversion state
 * against the reference, both under the display's `modifications` settings;
 * `baseQuality` and `base` paint every aligned base. A string is the field.
 * While a modification field paints, mismatches draw grey, and a read with no
 * `color` of its own takes a pale strand tint.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', baseColor: 'modifications' }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   color: { field: 'tags.HP' },
 *   baseColor: { field: 'modifications' },
 *   modifications: { twoColor: true },
 * }
 * ```
 */
export const alignmentsBaseColorConfigSchema = ConfigurationSchema(
  'AlignmentsBaseColor',
  {
    /**
     * #slot field
     */
    field: {
      type: 'string',
      defaultValue: '',
      description:
        'the per-base variable painted over the reads: modifications, bisulfite, baseQuality or base; empty draws none',
    },
    /**
     * #slot scale
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('AlignmentsBaseColorScale', ['none']),
      description: 'none draws no layer and keeps the field for a switch back',
    },
  },
  { shorthand: 'field', closed: true },
)
