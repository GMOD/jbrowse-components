import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { chordColorConfigSchema } from './chordColorConfigSchema.ts'

/**
 * #config ChordEncoding
 * #category display
 * A variant chord display's `encoding`, the channels its chords paint
 * through.
 *
 * #example
 * ```js
 * { type: 'ChordVariantDisplay', encoding: { color: { value: 'teal' } } }
 * ```
 */
export const chordEncodingConfigSchema = ConfigurationSchema(
  'ChordEncoding',
  {
    /**
     * #slot color
     * The line color of each resting chord: `{ value }`, a CSS color or
     * `jexl:` callback, or a field of the record, `svType` say, whose values
     * each take a color with a key on the circle.
     */
    color: chordColorConfigSchema,
  },
  encodingOptions,
)
