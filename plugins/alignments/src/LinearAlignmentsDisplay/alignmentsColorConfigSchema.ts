import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorChannelOptions,
  colorDescendingSlot,
  colorDomainEndsSlots,
  colorDomainQuantileSlot,
  colorDomainSlot,
  colorFieldSlot,
  colorLegendOptions,
  colorRampSlots,
  colorRangeSlot,
  colorScaleOptions,
  colorScaleTypeSlot,
  colorTitleSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

import {
  ALIGNMENTS_COLOR_SCALES,
  ALIGNMENTS_FIELD_PRESETS,
} from '../shared/alignmentsColor.ts'

/**
 * #config AlignmentsColor
 * #category display
 * The alignments displays' `encoding.color`: one color for every read in
 * `value`, or a field of each read. A preset field, listed below, colors by
 * its levels or bins, `tags.XX` reads a SAM tag, and any other name reads
 * the read as a facet over it does: `mateAssembly`, a feature attribute, a
 * dotted path into one or a `jexl:` expression. A string is the field.
 * `split`, `spliced`, `pairing` and `svSignal` color nothing: reads keep their
 * arcs' colors, and a facet sections them by those.
 * The per-base layer over the reads is `pileup.bases`.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', encoding: { color: 'strand' } }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   encoding: {
 *     color: {
 *       field: 'tags.HP',
 *       scale: {
 *         domain: ['1', '2'],
 *         range: ['#d95f02', '#1b9e77'],
 *         names: ['Maternal', 'Paternal'],
 *         invalid: '#cccccc',
 *       },
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   encoding: {
 *     color: { field: 'tags.NM', scale: { type: 'linear', scheme: 'viridis' } },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   encoding: { color: { field: 'insertSize', scale: { domain: [150, 600] } } },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   encoding: {
 *     color: {
 *       field: 'pairOrientation',
 *       scale: { domain: ['RR'], range: ['#d95f02'] },
 *     },
 *   },
 * }
 * ```
 */
export const alignmentsColorConfigSchema = ConfigurationSchema(
  'AlignmentsColor',
  {
    /**
     * #slot value
     * The fill of every read while no field paints. Arcs and pair
     * orientations keep the theme's colors. Unset, the theme's read color.
     */
    value: {
      type: 'maybeColor',
      description: 'CSS color of every read while no field paints',
    },
    ...colorFieldSlot({
      fieldType: 'string',
      field:
        'field to color each read by: a preset field by its levels or bins; tags.XX reads a SAM tag; any other name reads as a facet over it does: mateAssembly, a feature attribute, a dotted path or a jexl: expression; split, spliced, pairing and svSignal color nothing, as a facet sections by them',
    }),
    /**
     * #slot scale
     * How the field's values map to colors, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'AlignmentsColorScale',
      {
        ...colorScaleTypeSlot({
          scales: ALIGNMENTS_COLOR_SCALES,
          scaleName: 'AlignmentsColorScaleType',
          type: 'ordinal a range color per value; linear a ramp over mapq or a numeric tag or attribute between domainMin and domainMax; threshold the bins domain cuts; unset, threshold over insertSize, insertSizeAndOrientation and mapq, and ordinal over any other field',
        }),
        ...colorDomainSlot({
          domain:
            "for an ordinal scale, the values that take the range first, in order: a preset field's levels, insertSize's short, normal and long, with unmappedMate and interchrom under both insert-size fields, '' a read with no value, a MAPQ, 255 for unavailable, or a tag's values; for a threshold scale, the cut points, which over insertSize are the two between short, normal and long, where the sampled distribution otherwise sets them",
        }),
        ...colorRangeSlot({
          range:
            "CSS colors an ordinal scale hands its domain in order, or with no domain a preset field's levels in their preset order, a threshold scale its bins, or a linear scale's stops, evenly spaced; a level left out keeps its default; empty uses the field's default colors, cividis over mapq's bins, the tag palette or viridis",
        }),
        /**
         * #slot scale.invalid
         * The fill of a read with no value under the field, Vega-Lite's word
         * for a missing value's output: no tag, no
         * attribute, or no mate under `mateRefName`. A `''` in `domain`
         * colors it by its `range` entry instead.
         */
        invalid: {
          type: 'maybeColor',
          description:
            'CSS color of a read with no value under the field; unset, the theme color',
        },
        /**
         * #slot scale.unknown
         * The fill of a read whose tag, attribute, mate reference or MAPQ an
         * ordinal `domain` leaves out, d3's `ordinal.unknown`:
         * `unknown: "#999"` beside `domain: ["1", "2"]` on `tags.HP` paints
         * every other haplotype grey, and the key lists them as one row,
         * Other. A field with fixed levels, such as strand, has no value
         * outside them.
         */
        unknown: {
          type: 'maybeColor',
          description:
            'CSS color of a read whose tag, attribute, mate reference or MAPQ the ordinal domain leaves out, keyed as one row, Other; unset deals the next palette color, "" the no-value grey',
        },
        /**
         * #slot scale.names
         * Names for each level or value `range` colors, in the same order, in
         * the key, the hovers and the arc key: `names: ["Maternal",
         * "Paternal"]` beside `domain: ["1", "2"]` on `tags.HP`.
         */
        names: {
          type: 'stringArray',
          defaultValue: [],
          description:
            "key name for each value domain lists, in order, or with no domain for each of a preset field's levels in level order, a threshold scale's bins from the lowest; an empty or missing entry shows the value's name",
        },
        ...colorRampSlots,
        ...colorDomainEndsSlots,
        ...colorDomainQuantileSlot,
      },
      colorScaleOptions('encoding.color.scale'),
    ),
    /**
     * #slot legend
     * The key this channel draws.
     */
    legend: ConfigurationSchema(
      'AlignmentsColorLegend',
      { ...colorTitleSlot, ...colorDescendingSlot },
      colorLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color', ALIGNMENTS_FIELD_PRESETS),
)
