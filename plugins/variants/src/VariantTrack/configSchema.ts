import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createBaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config VariantTrack
 * Mostly similar to feature track, but has `ChordDisplayType` registered to it,
 * and custom feature details in `LinearVariantDisplay`
 *
 * #example
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'my-variants',
 *   name: 'My variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/variants.vcf.gz',
 *   },
 * }
 * ```
 *
 * #example
 * The same track with appearance settings in place. Rather than writing out the
 * full `displays` array, you can list them in a `displayDefaults` object —
 * JBrowse works out which display they belong to and applies them for you (here
 * it puts `color` on the `LinearVariantDisplay`), so you don't have to know
 * display names. A `jexl:` value works here for per-feature coloring:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'my-variants',
 *   name: 'My variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/variants.vcf.gz',
 *   },
 *   displayDefaults: { color: 'darkblue' },
 * }
 * ```
 */
export default function VariantTrackF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'VariantTrack',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: createBaseTrackConfig(pluginManager),
    },
  )
}
