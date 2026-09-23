import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorDomainSlot,
  colorRangeSlot,
  normalizeChannel,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * #config MafRowColor
 * #category display
 * The MAF display's `rowColor`: a tint per species row, by row name, as
 * `domain`/`range` pairs. It tints the row's label and the swatch the sidebar
 * draws for a row too short for text, over the colour an adapter's `samples`
 * entry gives; the alignment cells stay coloured by base. The arrangement
 * dialog's Color column edits it.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMafDisplay',
 *   rowColor: { domain: ['panTro4', 'mm10'], range: ['#4e79a7', '#f28e2b'] },
 * }
 * ```
 */
export const mafRowColorSchema = ConfigurationSchema(
  'MafRowColor',
  {
    ...colorDomainSlot({
      domain: 'the species rows given a tint of their own, by row name',
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
