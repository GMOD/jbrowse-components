import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #config YEncoding
 * #category display
 * A display's `encoding` holding the y channel alone, whose marks each name
 * the field their `encoding.y` reads through it.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMarkDisplay',
 *   encoding: { y: { scale: { type: 'log' }, axis: { title: 'depth' } } },
 * }
 * ```
 */
export function yEncodingSchema<Y extends AnyConfigurationSchemaType>(y: Y) {
  return ConfigurationSchema(
    'YEncoding',
    {
      /**
       * #slot y
       * The value axis every mark's `encoding.y` is read through: `scale`,
       * `axis` and `rules`.
       */
      y,
    },
    { closed: true, plot: true },
  )
}
