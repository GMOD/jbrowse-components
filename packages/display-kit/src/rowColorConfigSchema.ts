import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  colorDomainSlot,
  colorRangeSlot,
  normalizeChannel,
} from './colorConfigSchema.ts'

/**
 * #config RowColor
 * #category display
 * The `rowColor` setting of the row displays: the colour a reader sets on a
 * row, by the row's name, as `domain`/`range` pairs. The arrangement dialog
 * writes it, and each display paints it on the channel that carries a row's
 * identity: the quantitative display's plot, or the tint beside its label
 * while a score gradient paints; the multi-row feature display's blocks; the
 * multi-sample variant displays' label tint. `VariantRowColor` is this plus
 * `field`.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rowColor: { domain: ['tumor', 'normal'], range: ['#b2182b', '#2166ac'] },
 * }
 * ```
 */
export const rowColorConfigSchema = ConfigurationSchema(
  'RowColor',
  {
    ...colorDomainSlot({
      domain: 'the rows given a colour of their own, by name',
    }),
    ...colorRangeSlot({
      range: 'the CSS colour each row in domain takes, in the same order',
    }),
  },
  {
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'rowColor'),
  },
)
