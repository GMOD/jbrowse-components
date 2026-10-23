import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { syntenyColorConfigSchema } from './syntenyColorConfigSchema.ts'
import { syntenyOpacityConfigSchema } from './syntenyOpacityConfigSchema.ts'

/**
 * #config SyntenyEncoding
 * #category view
 * The linear synteny, dotplot and circular views' `encoding`: the channels
 * every track in the view paints its alignments through.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', encoding: { color: 'query', opacity: 0.4 } }
 * ```
 */
export const syntenyEncodingConfigSchema = ConfigurationSchema(
  'SyntenyEncoding',
  {
    /**
     * #slot color
     * Each alignment's color: `{ value }`, or a field and the `scale` its
     * values map through, with a key.
     */
    color: syntenyColorConfigSchema,
    /**
     * #slot opacity
     * Each alignment's opacity: a number, or a field read into opacities.
     */
    opacity: syntenyOpacityConfigSchema,
  },
  encodingOptions,
)

export type SyntenyEncodingConfigModel = typeof syntenyEncodingConfigSchema
