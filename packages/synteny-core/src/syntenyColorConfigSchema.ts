import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * `scale` on a synteny colour object is the set/map switch alone: a field's
 * type is read off the fetched values, a span for numbers and a label list
 * for text.
 */
export const SYNTENY_COLOR_SCALES = ['none'] as const

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

/** A synteny colour object as its snapshot holds it. */
export interface SyntenyColorSnapshot {
  value?: string
  field?: string
  scale?: SyntenyColorScale
  domain?: readonly string[]
}

/**
 * #config SyntenyColor
 * #category view
 * The linear synteny and dotplot views' `colorBy` setting, which every track
 * in the view paints with: one colour for every alignment, or a field each
 * alignment carries — its strand, the sequence at either end, the anchor
 * assembly's, the track it came from, a measurement on its preset ramp
 * (`identity`, `mapq`, `dnds`), or a column the tracks declare in
 * `attributeColumns`. A string is the constant.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', colorBy: { field: 'strand' } }
 * ```
 * ```js
 * { type: 'DotplotView', colorBy: { field: 'query' } }
 * ```
 * ```js
 * {
 *   type: 'LinearSyntenyView',
 *   colorBy: { field: 'gene_group', domain: ['A1a', 'B1'] },
 * }
 * ```
 */
export const syntenyColorConfigSchema = ConfigurationSchema(
  'SyntenyColor',
  {
    /**
     * #slot value
     * The colour of every alignment under the `none` scale, in place of the
     * view's default scheme: the match block of a synteny ribbon, whose
     * insertions and deletions keep their colours, or a dotplot point.
     * Writing `colorBy: "grey"` lands here. Unset, the default scheme paints.
     */
    value: {
      type: 'maybeColor',
      description:
        'the color of every alignment in place of the default scheme',
    },
    ...colorChannelSlots({
      scales: SYNTENY_COLOR_SCALES,
      scaleName: 'SyntenyColorScale',
      fieldType: 'string',
      field:
        'what colours an alignment: strand paints forward and reverse; query and target one colour per sequence on that side, reference one per chromosome of the anchor assembly across a stack, track one per overlaid track (pinned under Track colors); identity, mapq and dnds paint the preset ramps; any other name is a column the tracks declare in attributeColumns, a ramp over the values seen for numbers and one colour per label for text (or the colour a color column put beside it)',
      scale:
        'none paints value and keeps the field for a switch back; unset, a field paints',
    }),
    ...colorDomainSlot({
      domain:
        "a text column's labels that take the palette first, in order, and lead the key, the rest following sorted; a label left out keeps a colour derived from itself that no listed label paints, so every window and session agrees on it",
    }),
  },
  colorChannelOptions('colorBy'),
)

export type SyntenyColorConfigModel = typeof syntenyColorConfigSchema
