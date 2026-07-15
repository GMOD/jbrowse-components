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
 *
 * #example
 * A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
 * `tracks`. `displayMode` sets the feature height preset (`normal`, `compact`,
 * or `superCompact`):
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'genes',
 *   name: 'Genes',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'Gff3TabixAdapter',
 *     uri: 'https://example.com/genes.gff3.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearBasicDisplay',
 *       displayId: 'genes-LinearBasicDisplay',
 *       height: 200,
 *       displayMode: 'compact',
 *     },
 *   ],
 * }
 * ```
 */
export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBasicDisplay',
    {
      /**
       * #slot
       * Feature (GFF/BED) tracks are light text, and the tabix byte estimate is
       * block-granular (a small region still pulls whole BGZF blocks), so a
       * single gene can trip a tighter gate. A few Mb of feature text downloads
       * fast; the feature-density gate remains the backstop for genuinely
       * over-dense views. VcfTabixAdapter matches this 5 Mb for the same reason;
       * the binary alignment adapters (CRAM 3 Mb) keep their own tighter limit.
       */
      fetchSizeLimit: {
        type: 'number',
        defaultValue: 5_000_000,
        description:
          'maximum data to attempt to download for a given feature track',
        advanced: true,
      },
    },
    {
      baseConfiguration: baseConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export type LinearBasicDisplayConfigModel = Instance<
  ReturnType<typeof configSchemaFactory>
>
