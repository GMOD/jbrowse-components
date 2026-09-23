import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorDomainSlot,
  colorRangeSlot,
  normalizeChannel,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config MultiRowRowColor
 * #category display
 * The multi-row feature display's `rowColor`: a colour per row, by the row's
 * value, as `domain`/`range` pairs. It paints every block on the row over the
 * colour each feature carries, and the arrangement dialog's Row color column
 * edits it.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMultiRowFeatureDisplay',
 *   rowColor: { domain: ['HG00096', 'HG00097'], range: ['#4e79a7', '#f28e2b'] },
 * }
 * ```
 */
export const multiRowRowColorSchema = ConfigurationSchema(
  'MultiRowRowColor',
  {
    ...colorDomainSlot({
      domain: 'the rows given a colour of their own, by value',
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
