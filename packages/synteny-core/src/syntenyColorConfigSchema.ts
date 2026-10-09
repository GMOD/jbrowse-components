import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { MEASURE_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import {
  colorChannelOptions,
  colorChannelSlots,
  colorDescendingSlot,
  colorDomainEndsSlots,
  colorDomainSlot,
  colorLabelsSlot,
  colorRampSlots,
  colorRangeSlot,
  colorTitleSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * `scale` on a synteny color object: `none` paints `value`, and `linear` or
 * `threshold` names how a number paints. Unset, a measurement takes its
 * preset's scale and a column's type is read off the fetched values, a ramp
 * over the span for numbers and a color per label for text.
 */
export const SYNTENY_COLOR_SCALES = ['none', 'linear', 'threshold'] as const

export type SyntenyColorScale = (typeof SYNTENY_COLOR_SCALES)[number]

/**
 * The fields the linear synteny and dotplot views read as a mode of their own,
 * beside the measurement presets: an alignment's strand, the sequence at
 * either end, the anchor assembly's, and the track it came from.
 */
export const SYNTENY_VIEW_FIELDS = [
  'strand',
  'query',
  'target',
  'reference',
  'track',
] as const

/** A synteny color object as its snapshot holds it. */
export interface SyntenyColorSnapshot extends Partial<ColorSetting> {}

/**
 * The slots every comparative color object declares: the linear synteny and
 * dotplot views' `color` and the multi-way display's `ribbonColor`, which
 * paint through the same resolver.
 */
export function syntenyColorSlots({
  scaleName,
  field,
}: {
  scaleName: string
  field: string
}) {
  return {
    ...colorChannelSlots({
      scales: SYNTENY_COLOR_SCALES,
      scaleName,
      fieldType: 'string',
      field,
      scale:
        'none paints value and keeps the field for a switch back; linear runs a number along a ramp and threshold bins it at the cuts domain lists; unset, a measurement paints its own scale and a column one read off its values',
    }),
    ...colorDomainSlot({
      domain:
        "a text column's labels that take the palette first, in order, and lead the key, the rest following sorted, strand's values (1, -1) in the order range colors them, or a threshold's cuts; a label left out takes a color no listed label or label met before it paints, the first time the view meets it, and keeps it",
    }),
    ...colorRangeSlot({
      range:
        "CSS colors a text column's labels or strand's values take, in domain order, continuing into the default palette past its end; with no domain, each label takes one of them by its name; on a ramp (identity, dnds or a numeric column), its stops, evenly spaced, in place of the field's own; under threshold, one per interval",
    }),
    ...colorRampSlots,
    ...colorDomainEndsSlots,
    ...colorLabelsSlot,
    ...colorDescendingSlot,
    ...colorTitleSlot,
  }
}

/**
 * #config SyntenyColor
 * #category view
 * The linear synteny and dotplot views' `color` setting, which every track
 * in the view paints with: one color for every alignment, or a field each
 * alignment carries — its strand, the sequence at either end, the anchor
 * assembly's, the track it came from, a measurement through its preset
 * (`identity` and `dnds` on a ramp, `mapq` in the alignments display's bins),
 * or a column the tracks declare in `attributeColumns`. A string is the
 * constant.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', color: { field: 'strand' } }
 * ```
 * ```js
 * { type: 'DotplotView', color: { field: 'query' } }
 * ```
 * ```js
 * { type: 'LinearSyntenyView', color: { field: 'identity', scheme: 'magma', domainMin: 0.9 } }
 * ```
 * ```js
 * { type: 'LinearSyntenyView', color: { field: 'identity', scale: 'threshold', domain: ['0.95', '0.99'] } }
 * ```
 * ```js
 * {
 *   type: 'LinearSyntenyView',
 *   color: {
 *     field: 'gene_group',
 *     domain: ['A1a', 'B1'],
 *     range: ['#1b9e77', '#d95f02'],
 *     labels: ['Subgenome A', 'Subgenome B'],
 *     title: 'Gene group',
 *   },
 * }
 * ```
 */
export const syntenyColorConfigSchema = ConfigurationSchema(
  'SyntenyColor',
  {
    /**
     * #slot value
     * The color of every alignment under the `none` scale, in place of the
     * view's default scheme: the match block of a synteny ribbon, whose
     * insertions and deletions keep their colors, or a dotplot point.
     * Writing `color: "grey"` lands here. Unset, the default scheme paints.
     */
    value: {
      type: 'maybeColor',
      description:
        'the color of every alignment in place of the default scheme',
    },
    ...syntenyColorSlots({
      scaleName: 'SyntenyColorScale',
      field:
        'what colors an alignment: strand paints forward and reverse; query and target one color per sequence on that side, reference one per chromosome of the anchor assembly across a stack, track one per overlaid track (pinned under Track colors); identity and dnds paint their preset ramps and mapq its bins; any other name is a column the tracks declare in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a color column put beside it)',
    }),
  },
  colorChannelOptions('color', MEASURE_FIELD_PRESETS),
)

export type SyntenyColorConfigModel = typeof syntenyColorConfigSchema
