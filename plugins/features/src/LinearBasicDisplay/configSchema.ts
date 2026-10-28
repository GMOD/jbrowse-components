import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { featureUtrsConfigSchema } from '@jbrowse/display-kit/featureUtrsConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import baseConfigSchemaFactory from './baseConfigSchema.ts'
import { featureContainersConfigSchema } from './featureContainersConfigSchema.ts'
import { featureDescriptionLabelConfigSchema } from './featureDescriptionLabelConfigSchema.ts'
import { featureNameLabelConfigSchema } from './featureNameLabelConfigSchema.ts'
import { featureSubfeatureLabelsConfigSchema } from './featureSubfeatureLabelsConfigSchema.ts'
import { featureTranscriptsConfigSchema } from './featureTranscriptsConfigSchema.ts'
import { GENE_GLYPH_MODES } from './geneGlyphMode.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearBasicDisplay
 * #category display
 * Draws the genes and other features of a `FeatureTrack`, from a BED, GFF or
 * similar file. The display adds the gene-glyph slots (isoforms, UTRs,
 * chevrons) to the shared canvas base. `encoding.color` paints each
 * feature's fill and `utrs.encoding.color` its UTRs; the intron lines, chevrons and
 * strand arrows take the theme's stroke color.
 *
 * #example
 * A `FeatureTrack` with compact features. `displayMode` is `normal`,
 * `compact`, `superCompact` or `collapsed` (one row):
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
       * The UTR boxes, a [](/docs/config/featureutrs) object. Unset, a UTR
       * takes its transcript's fill, a feature's own BED itemRgb included
       * (matching UCSC's whole-item coloring), else a contrasting blue.
       */
      utrs: featureUtrsConfigSchema,
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
       * #slot labels
       * The text drawn beside each feature: the base's name and description,
       * and the names of its parts.
       */
      labels: ConfigurationSchema(
        'FeatureLabels',
        {
          /**
           * #slot labels.name
           * Each feature's name, a [](/docs/config/featurenamelabel) object.
           */
          name: featureNameLabelConfigSchema,
          /**
           * #slot labels.description
           * The line under each name, a
           * [](/docs/config/featuredescriptionlabel) object.
           */
          description: featureDescriptionLabelConfigSchema,
          /**
           * #slot labels.subfeatures
           * The names of a feature's parts, a
           * [](/docs/config/featuresubfeaturelabels) object.
           */
          subfeatures: featureSubfeatureLabelsConfigSchema,
        },
        { plot: true },
      ),
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
    },
  )
}

// The schema type is what a state model factory annotates its `configSchema`
// param with, the only lever that narrows that model's config reads.
export type LinearBasicDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearBasicDisplayConfig = Instance<LinearBasicDisplayConfigModel>
