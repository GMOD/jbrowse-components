import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearCanvasBaseDisplayConfigSchemaFactory } from '@jbrowse/plugin-canvas'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearVariantDisplay
 *
 * Extends LinearCanvasBaseDisplay for GPU-accelerated variant rendering.
 *
 * #example
 * Minimal `VariantTrack` config. See the
 * [variant track guide](/docs/config_guides/variant_track) for all options:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'variants',
 *   name: 'Variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/variants.vcf.gz',
 *   },
 * }
 * ```
 *
 * #example
 * Taller track. The `displays` object shorthand is equivalent to
 * `displays: [{ type: 'LinearVariantDisplay', displayId: '...', ... }]` — see
 * [configuring displays](/docs/config_guides/tracks#configuring-displays):
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'variants',
 *   name: 'Variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/variants.vcf.gz',
 *   },
 *   displays: { height: 200 },
 * }
 * ```
 */

export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearVariantDisplay',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration:
        linearCanvasBaseDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export type LinearVariantDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearVariantDisplayConfig =
  Instance<LinearVariantDisplayConfigModel>
