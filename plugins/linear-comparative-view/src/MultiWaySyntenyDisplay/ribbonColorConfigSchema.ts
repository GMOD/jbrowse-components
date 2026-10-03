import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorChannelOptions,
  colorChannelSlots,
  colorDomainEndsSlots,
  colorDomainSlot,
  colorLabelsSlot,
  colorRampSlots,
  colorRangeSlot,
  colorTitleSlot,
} from '@jbrowse/display-kit/colorConfigSchema'
import { SYNTENY_COLOR_SCALES } from '@jbrowse/synteny-core'

/**
 * #config RibbonColor
 * #category display
 * The multi-way synteny display's `ribbonColor` setting: one colour for every
 * ribbon, or a field each ribbon carries: the record's strand, a measurement
 * on its preset ramp (`identity`, `mapq`, `dnds`), or a column the
 * table declares in `attributeColumns`. A string is the constant.
 *
 * #example
 * ```js
 * { type: 'MultiWaySyntenyDisplay', ribbonColor: 'rgba(130,130,130,0.3)' }
 * ```
 * ```js
 * { type: 'MultiWaySyntenyDisplay', ribbonColor: { field: 'strand' } }
 * ```
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   ribbonColor: { field: 'group', domain: ['core', 'shell'] },
 * }
 * ```
 */
export const ribbonColorConfigSchema = ConfigurationSchema(
  'RibbonColor',
  {
    /**
     * #slot value
     * The colour of every ribbon under the `none` scale, and of a pair
     * carrying no value under a field.
     */
    value: {
      type: 'color',
      description: 'the color of the ribbons connecting adjacent lanes',
      defaultValue: 'rgba(130,130,130,0.3)',
    },
    ...colorChannelSlots({
      scales: SYNTENY_COLOR_SCALES,
      scaleName: 'RibbonColorScale',
      fieldType: 'string',
      field:
        "what colours a ribbon: strand reads the relative strand between the two lanes the ribbon joins (the two placements' orientations multiplied out, not the drawn twist, so a flipped lane still shows its inversions); identity, mapq and dnds paint the synteny view's ramps; any other name is a column the table declares in attributeColumns, a ramp over the values seen for numbers and one colour per label for text (or the colour a color column put beside it)",
      scale:
        'none paints value and keeps the field for a switch back; unset, a field paints',
    }),
    ...colorDomainSlot({
      domain:
        "a text column's labels that take the palette first, in order, and lead the key, the rest following sorted; a label left out takes a colour no listed label or label met before it paints, the first time the view meets it, and keeps it",
    }),
    ...colorRangeSlot({
      range:
        "CSS colours a text column's labels take, in domain order, continuing into the default palette past its end; with no domain, each label takes one of them by its name; on a ramp (identity, mapq, dnds or a numeric column), its stops, evenly spaced, in place of the field's own",
    }),
    ...colorRampSlots,
    ...colorDomainEndsSlots,
    ...colorLabelsSlot,
    ...colorTitleSlot,
  },
  colorChannelOptions('ribbonColor'),
)
