import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  CATEGORICAL_COLOR_SCALES,
  colorChannelSlots,
  colorDomainSlot,
  colorRangeSlot,
  normalizeChannel,
} from './colorConfigSchema.ts'

/**
 * #config RowColor
 * #category display
 * The `rowColor` setting of the row displays: one categorical colour channel
 * on the row axis. `field` names the row attribute whose values take the
 * colours, `name` (the row itself) by default, and `domain`/`range` pair those
 * values with CSS colours, so a colour a reader sets on a row in the
 * arrangement dialog is an entry under `name`. Each display paints it on the
 * channel that carries a row's identity: the quantitative display's plot, or
 * the tint beside its label while a score gradient paints; the multi-row
 * feature display's blocks; the multi-sample variant displays' label tint,
 * where `field` may also name a samplesTsv column whose values each take a
 * palette colour; the MAF display's label tint, over the adapter's
 * `samples[].color`; the mark display's label tint, over a listed source's
 * colour. A string is the field.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rowColor: { domain: ['tumor', 'normal'], range: ['#b2182b', '#2166ac'] },
 * }
 * ```
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', rowColor: 'population' }
 * ```
 */
export const rowColorConfigSchema = ConfigurationSchema(
  'RowColor',
  {
    ...colorChannelSlots({
      scales: CATEGORICAL_COLOR_SCALES,
      scaleName: 'RowColorScale',
      fieldType: 'string',
      fieldDefault: 'name',
      field:
        "the row attribute whose values take the colours: name, the row itself, or on the multi-sample variant displays a column of the adapter's samplesTsvLocation, e.g. population",
      scale:
        'none paints nothing from this setting and keeps the field for a switch back; categorical a colour per value of field; unset follows field',
    }),
    ...colorDomainSlot({
      domain:
        "the field's values given a colour of their own, in order: under name, rows by name",
    }),
    ...colorRangeSlot({
      range: 'the CSS colour each value in domain takes, in the same order',
    }),
  },
  {
    shorthand: 'field',
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'rowColor'),
  },
)
