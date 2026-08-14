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
 *   "color": "jexl:feature.type=='gene'?'blue':'gray'"
 * }
 * ```
 *
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
       * Feature (GFF/BED) tracks are light text, and the tabix byte estimate is
       * block-granular (a small region still pulls whole BGZF blocks), so a
       * single gene can trip a tighter gate. A few Mb of feature text downloads
       * fast; the feature-density gate remains the backstop for genuinely
       * over-dense views. An adapter declaring its own `fetchSizeLimit` outranks
       * this — the generated table in
       * agent-docs/reference/REGION_TOO_LARGE.md § Shared primitives is which
       * ones do, rather than a number restated here that goes stale when theirs
       * moves (CRAM's did).
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
       * Useful on an NCBI/Ensembl annotation whose non-gene records (regions,
       * match features, biological regions) would otherwise crowd the genes out.
       * ANDed with `jexlFilters` when both are set.
       */
      showOnlyGenes: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot
       * Explicit color key drawn over the track: an array of
       * `{ label, color }`. A `jexl:` `color` expression is a lookup table only
       * its author can read — the drawn feature carries the color but nothing
       * carries what the color MEANS — so the config declares the vocabulary
       * beside the expression that paints it. `color` is any CSS color and
       * should be the same string the expression returns.
       *
       * Empty (the default) draws nothing. Dismissable on screen, like every
       * other floating key.
       *
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

// Schema type and instance type, named the way every sibling display names them
// (`LinearVariantDisplayConfigModel` / `…Config`). The schema type is what a
// state model factory annotates its `configSchema` param with, which is the
// only lever that narrows that model's config reads — see
// packages/core/src/configuration/CLAUDE.md §"Read type narrowing".
export type LinearBasicDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearBasicDisplayConfig = Instance<LinearBasicDisplayConfigModel>
