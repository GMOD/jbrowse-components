import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { colorConfigSchema, encodingOptions } from './colorConfigSchema.ts'

/**
 * #config FeatureEncoding
 * #category display
 * The feature displays' `encoding`, the channels the features paint
 * through.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', encoding: { color: 'gene_biotype' } }
 * ```
 */
export const featureEncodingConfigSchema = ConfigurationSchema(
  'FeatureEncoding',
  {
    /**
     * #slot color
     * The main fill of each feature: `{ value }`, a CSS color or a jexl
     * expression, or a field and the `scale` its values map through, with a
     * key.
     */
    color: colorConfigSchema,
  },
  encodingOptions,
)
