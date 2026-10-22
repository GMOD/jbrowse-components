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
  encodingOptions,
} from '@jbrowse/display-kit/colorConfigSchema'

import {
  ALIGNMENTS_COLOR_SCALES,
  ALIGNMENTS_FIELD_PRESETS,
} from '../shared/alignmentsColor.ts'

/**
 * #config AlignmentsColor
 * #category display
 * The alignments displays' `encoding.color`: one color for every read in
 * `value`, or a field of each read. A read dimension colors by its fixed
 * levels (`strand`, `firstOfPairStrand`, `pairOrientation`, `insertSize`,
 * `insertSizeAndOrientation`, `mateRefName`) or bins (`mapq`, the four a
 * facet over it stacks), `tags.XX` reads a SAM tag, and any other name reads
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
 *         unknown: '#cccccc',
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
        'field to color each read by: strand, firstOfPairStrand, pairOrientation, insertSize, insertSizeAndOrientation and mateRefName color by their fixed levels and mapq by its four bins; tags.XX reads a SAM tag; any other name reads as a facet over it does: mateAssembly, a feature attribute, a dotted path or a jexl: expression; split, spliced, pairing and svSignal color nothing, as a facet sections by them',
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
            "for an ordinal scale, the values that take the range first, in order: a preset field's levels (strand 1 and -1; pairOrientation LR, RL, RR and LL; insertSize short, normal and long; under the insert-size and orientation fields, unmappedMate and interchrom, and in a chain under the orientation ones splitInverted, splitSameStrand, segmentInverted and segmentSameStrand; '' a read with no value), a MAPQ, 255 for unavailable, or a tag's values; for a threshold scale, the cut points, which over insertSize are the two between short, normal and long, where the sampled distribution otherwise sets them, and over mapq 1, 10 and 30",
        }),
        ...colorRangeSlot({
          range:
            "CSS colors an ordinal scale hands its domain in order, or with no domain a preset field's levels in their preset order, a threshold scale its bins, or a linear scale's stops, evenly spaced; a level left out keeps its default; empty uses the field's default colors, cividis over mapq's bins, the tag palette or viridis",
        }),
        /**
         * #slot unknown
         * The fill of a read with no value under the field: no tag, no
         * attribute, or no mate under `mateRefName`. A `''` in `domain`
         * colors it by its `range` entry instead.
         */
        unknown: {
          type: 'maybeColor',
          description:
            'CSS color of a read with no value under the field; unset, the theme color',
        },
        /**
         * #slot names
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

/**
 * #config AlignmentsEncoding
 * #category display
 * The alignments displays' `encoding`, the channels the reads paint through.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', encoding: { color: 'tags.HP' } }
 * ```
 */
export const alignmentsEncodingConfigSchema = ConfigurationSchema(
  'AlignmentsEncoding',
  {
    /**
     * #slot color
     * The read fill: `{ value: "steelblue" }` paints every read,
     * `"strand"` a read dimension's own vocabulary and `"tags.HP"` a SAM
     * tag.
     */
    color: alignmentsColorConfigSchema,
  },
  encodingOptions,
)
