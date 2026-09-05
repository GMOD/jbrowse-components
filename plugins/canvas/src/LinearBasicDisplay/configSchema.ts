import { ConfigurationSchema } from '@jbrowse/core/configuration'

import baseConfigSchemaFactory from './baseConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearBasicDisplay
 * #category display
 * configuration for the basic linear feature display (genes, BED, GFF, etc.);
 * the color slots `color`, `connectorColor` and `utrColor` are display-level,
 * set inside a track's `displays` array, each a CSS color or a `jexl:`
 * expression for per-feature coloring.
 * #example
 * A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
 * `tracks`. `displayMode` sets the feature height preset (`normal`, `compact`,
 * or `superCompact`), or `collapsed` for a single-row overview:
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
       * Feature (GFF/BED) tracks are light text, and the tabix byte estimate
       * is block-granular (a small region still pulls whole BGZF blocks), so
       * a single gene can trip a tighter gate.
       */
      fetchSizeLimit: {
        type: 'number',
        defaultValue: 5_000_000,
        description:
          'maximum data to attempt to download for a given feature track',
        advanced: true,
      },
      /**
       * #slot
       * Draw only gene-like top-level features, dropping everything else the
       * file carries — the config form of the track menu's "Show only genes".
       */
      showOnlyGenes: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot
       * Explicit color key drawn over the track: an array of `{ label, color
       * }`.
       * #example
       * ```js
       * {
       *   type: 'LinearBasicDisplay',
       *   color:
       *     "jexl:{SINE:'#e41a1c',LINE:'#377eb8'}[feature.repClass] || 'gray'",
       *   legend: [
       *     { label: 'SINE', color: '#e41a1c' },
       *     { label: 'LINE', color: '#377eb8' },
       *   ],
       * }
       * ```
       */
      legend: {
        type: 'frozen',
        defaultValue: [],
        description:
          'explicit {label,color} color key for a jexl-colored track; empty draws none',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

// The schema type is what a state model factory annotates its `configSchema`
// param with, the only lever that narrows that model's config reads.
export type LinearBasicDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearBasicDisplayConfig = Instance<LinearBasicDisplayConfigModel>
