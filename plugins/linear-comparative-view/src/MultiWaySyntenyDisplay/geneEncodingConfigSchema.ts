import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { geneColorConfigSchema } from './geneColorConfigSchema.ts'

/**
 * #config MultiWayGeneEncoding
 * #category display
 * The multi-way synteny display's `encoding`, the channels its gene glyphs
 * paint through.
 *
 * #example
 * ```js
 * { type: 'MultiWaySyntenyDisplay', encoding: { color: 'cluster' } }
 * ```
 */
export const geneEncodingConfigSchema = ConfigurationSchema(
  'MultiWayGeneEncoding',
  {
    /**
     * #slot color
     * The gene glyphs' fill: `{ value }`, a CSS color or `jexl:` callback,
     * goldenrod unset, or a field and the `scale` its values map through,
     * with a key.
     */
    color: geneColorConfigSchema,
  },
  encodingOptions,
)
