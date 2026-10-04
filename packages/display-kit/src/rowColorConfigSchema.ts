import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  colorDomainSlot,
  colorRangeSlot,
  colorUnknownSlot,
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
 * feature display's blocks; the multi-sample variant displays' label tint; the
 * MAF display's label tint, over the adapter's `samples[].color`; the mark
 * display's label tint, over a listed source's colour. Where the rows carry
 * attributes, a samplesTsv column or a subtrack's group, `field` may name one,
 * and its values each take a palette colour. Under `name` the palette deals only
 * where the rows share one panel, a wiggle overlay; stacked rows are named by
 * their labels. `unknown: ''` deals none, so only the values `domain` lists take
 * a colour and every other row keeps its own. A string is the field.
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
 * ```js
 * {
 *   type: 'LinearMultiRowFeatureDisplay',
 *   rowColor: { domain: ['mom'], range: ['#b2182b'], unknown: '#cccccc' },
 * }
 * ```
 */
export const rowColorConfigSchema = ConfigurationSchema(
  'RowColor',
  {
    field: {
      type: 'string',
      defaultValue: 'name',
      description:
        "the row attribute whose values take the colours: name, the row itself, or an attribute the rows carry, such as a column of a multi-sample variant adapter's samplesTsvLocation, e.g. population, or a subtrack's group",
    },
    ...colorDomainSlot({
      domain:
        "the field's values given a colour of their own, in order: under name, rows by name",
    }),
    ...colorRangeSlot({
      range: 'the CSS colour each value in domain takes, in the same order',
    }),
    ...colorUnknownSlot,
  },
  {
    shorthand: 'field',
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'rowColor'),
  },
)
