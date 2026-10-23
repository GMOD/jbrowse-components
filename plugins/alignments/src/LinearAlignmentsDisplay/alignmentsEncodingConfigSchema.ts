import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { alignmentsColorConfigSchema } from './alignmentsColorConfigSchema.ts'

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
