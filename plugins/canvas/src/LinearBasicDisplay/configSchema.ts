import { ConfigurationSchema } from '@jbrowse/core/configuration'

import baseConfigSchemaFactory from './baseConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearBasicDisplay
 * #category display
 * configuration for the basic linear feature display (genes, BED, GFF, etc.)
 *
 * Color slots are display-level: set them inside a track's `displays` array.
 * `color` is the main feature fill; use a plain CSS color, or a `jexl:`
 * expression to color per-feature. (`connectorColor` and `utrColor` set the
 * intron lines and UTR fill. The legacy `color1`/`color2`/`color3` names still
 * work and map onto these.)
 *
 * ```json
 * {
 *   "type": "FeatureTrack",
 *   "trackId": "my_genes",
 *   "name": "Genes",
 *   "assemblyNames": ["hg19"],
 *   "adapter": { "type": "Gff3TabixAdapter", "uri": "genes.gff.gz" },
 *   "displays": [
 *     {
 *       "type": "LinearBasicDisplay",
 *       "color": "blue",
 *       "utrColor": "lightblue"
 *     }
 *   ]
 * }
 * ```
 *
 * Color by an attribute with a jexl expression:
 *
 * ```json
 * {
 *   "type": "LinearBasicDisplay",
 *   "color": "jexl:get(feature,'type')=='gene'?'blue':'gray'"
 * }
 * ```
 */
export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBasicDisplay',
    {},
    {
      baseConfiguration: baseConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export type LinearBasicDisplayConfigModel = Instance<
  ReturnType<typeof configSchemaFactory>
>
