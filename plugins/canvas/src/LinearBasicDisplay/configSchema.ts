import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import {
  GENE_GLYPH_DEFAULTS,
  SUBFEATURE_LABELS,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import baseConfigSchemaFactory from './baseConfigSchema.ts'
import { featureContainersConfigSchema } from './featureContainersConfigSchema.ts'
import { featureTranscriptsConfigSchema } from './featureTranscriptsConfigSchema.ts'
import { GENE_GLYPH_MODES } from './geneGlyphMode.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearBasicDisplay
 * #category display
 * Draws the genes and other features of a `FeatureTrack`, from a BED, GFF or
 * similar file. The display adds the gene-glyph slots (isoforms, UTRs,
 * chevrons) to the shared canvas base. The color slots `color`,
 * `connectorColor` and `utrColor` are display-level, set inside a track's
 * `displays` array, each a CSS color or a `jexl:` expression for per-feature
 * coloring.
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
       * Feature (GFF/BED) tracks are light text, and the tabix byte estimate
       * is block-granular (a small region still pulls whole BGZF blocks), so
       * a single gene can trip a tighter gate.
       */
      fetchSizeLimit: { type: 'number', defaultValue: 5_000_000 },
      /**
       * #slot
       */
      // `maybeColor` for the same reason as `color`: the default is
      // derive-from-theme, not a color.
      connectorColor: {
        type: 'maybeColor',
        description:
          'color of the connecting/intron lines between feature segments (defaults to the theme text color)',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      utrColor: {
        type: 'maybeColor',
        description:
          "fill color for UTRs on gene/transcript glyphs. Unset, a feature's own BED itemRgb paints them too (matching UCSC's whole-item coloring), else a contrasting blue",
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      geneGlyphMode: {
        type: 'stringEnum',
        model: types.enumeration('geneGlyphMode', [...GENE_GLYPH_MODES]),
        description:
          'Gene glyph display mode: "auto" collapses each gene to one transcript when zoomed out and trims the rest to what the track height holds, "all" draws every transcript and scrolls the surplus instead of trimming, "representative" shows one transcript per gene — the first by `transcripts.sort`, else the longest coding',
        defaultValue: 'auto',
      },
      /**
       * #slot
       */
      subfeatureLabels: {
        type: 'stringEnum',
        model: types.enumeration('subfeatureLabels', [...SUBFEATURE_LABELS]),
        description:
          "subfeature label display mode: `auto` (the default) names a polyprotein's cleavage products on their rows and nothing else; `none`, `below` or `overlay` apply to every part",
        defaultValue: GENE_GLYPH_DEFAULTS.subfeatureLabels,
      },
      /**
       * #slot chevrons
       * The arrows on a feature's intron lines.
       */
      chevrons: ConfigurationSchema(
        'FeatureChevrons',
        {
          /**
           * #slot chevrons.show
           */
          show: {
            type: 'boolean',
            description:
              'draw chevrons on intron lines pointing the way the feature reads',
            defaultValue: true,
          },
        },
        { closed: true },
      ),
      /**
       * #slot
       * How a gene's isoforms are read and ranked, a
       * [](/docs/config/featuretranscripts) object.
       */
      transcripts: featureTranscriptsConfigSchema,
      /**
       * #slot
       * The top-level types whose children stack on rows of their own, a
       * [](/docs/config/featurecontainers) object.
       */
      containers: featureContainersConfigSchema,
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
      retired: { showChevrons: show => ({ chevrons: { show } }) },
    },
  )
}

// The schema type is what a state model factory annotates its `configSchema`
// param with, the only lever that narrows that model's config reads.
export type LinearBasicDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearBasicDisplayConfig = Instance<LinearBasicDisplayConfigModel>
