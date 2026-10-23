import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { cellColorConfigSchema } from './cellColorConfigSchema.ts'

/**
 * #config VariantCellEncoding
 * #category display
 * The multi-sample variant display's `encoding`, the channels its genotype
 * cells paint through.
 *
 * #example
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', encoding: { color: 'svType' } }
 * ```
 */
export const cellEncodingConfigSchema = ConfigurationSchema(
  'VariantCellEncoding',
  {
    /**
     * #slot color
     * The hue of every genotype cell with an alt allele: unset, the genotype
     * colors; `{ value }`, a CSS color or `jexl:` callback; or a field, one
     * of the `impact`, `svType` and `phaseSet` presets or any record field,
     * whose values each take a color with a key.
     */
    color: cellColorConfigSchema,
  },
  encodingOptions,
)
