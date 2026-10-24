import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { colorConfigSchema } from '@jbrowse/display-kit/colorConfigSchema'
import { fieldPredicateArray } from '@jbrowse/display-kit/fieldPredicateConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import {
  GENE_GLYPH_DEFAULTS,
  SUBFEATURE_LABELS,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import baseConfigSchemaFactory from './baseConfigSchema.ts'
import { GENE_GLYPH_MODES } from './geneGlyphMode.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearBasicDisplay
 * #category display
 * Draws the genes and other features of a `FeatureTrack`, from a BED, GFF or
 * similar file. The display adds the gene-glyph slots (isoforms, subparts,
 * UTRs, chevrons) to the shared canvas base. The color slots `color`,
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
          'Gene glyph display mode: "auto" collapses each gene to one transcript when zoomed out and trims the rest to what the track height holds, "all" draws every transcript and scrolls the surplus instead of trimming, "longestCoding" shows one transcript per gene — the one canonicalTranscriptTags names, else the longest coding',
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
       * feature types the `geneLike` filter field counts beside
       * every gene, transcript and RNA type, plus the fallback for recognizing
       * a CHILDLESS transcript as one of a gene's isoforms.
       */
      transcriptTypes: {
        type: 'stringArray',
        // Not the isoform test: keying that off this list dropped every
        // `lnc_RNA`/`misc_RNA` isoform NCBI hangs off a gene, so the list is
        // only the childless-transcript fallback and the gene-only gate.
        defaultValue: GENE_GLYPH_DEFAULTS.transcriptTypes,
      },
      /**
       * #slot
       * feature attribute holding an isoform's curated "this one represents
       * the gene" tag.
       */
      canonicalTranscriptField: {
        type: 'string',
        defaultValue: GENE_GLYPH_DEFAULTS.canonicalTranscriptField,
      },
      /**
       * #slot
       * values of that attribute that mark an isoform as the gene's
       * representative one, which is then ranked ahead of every other
       * isoform: it is the transcript shown by `longestCoding`, and the first
       * kept when `auto` caps a gene at the rows the track has.
       */
      canonicalTranscriptTags: {
        type: 'stringArray',
        defaultValue: GENE_GLYPH_DEFAULTS.canonicalTranscriptTags,
      },
      /**
       * #slot
       * top-level feature types that always stack their children on separate
       * rows.
       */
      containerTypes: {
        type: 'stringArray',
        defaultValue: GENE_GLYPH_DEFAULTS.containerTypes,
      },
      /**
       * #slot
       */
      subParts: {
        type: 'string',
        description: 'subparts for a glyph',
        defaultValue: GENE_GLYPH_DEFAULTS.subParts,
      },
      /**
       * #slot transcriptFeatures
       * Features from other tracks drawn on each transcript they fit, such as
       * the protein domains `jbrowse make-protein-features` places, UniProt's
       * genome-mapped features or miRNA sites, in one color with one key. A
       * bare list names the tracks.
       */
      transcriptFeatures: ConfigurationSchema(
        'TranscriptFeatures',
        {
          /**
           * #slot transcriptFeatures.tracks
           * The tracks whose rows draw on the transcripts, each a trackId or
           * an object. A row fits a transcript when each of its blocks lies in
           * one of the transcript's exons (`on`), give or take a codon, and it
           * skips no exon between its first block and its last.
           */
          tracks: types.array(
            ConfigurationSchema(
              'TranscriptFeaturesTrack',
              {
                /**
                 * #slot transcriptFeatures.tracks.track
                 */
                track: {
                  type: 'string',
                  defaultValue: '',
                  description: 'trackId of the track whose rows draw',
                },
                /**
                 * #slot transcriptFeatures.tracks.on
                 * `cds` fits a row to a transcript's coding exons, as a
                 * protein feature is; `exon` to all its exons, as a site in a
                 * UTR is.
                 */
                on: {
                  type: 'stringEnum',
                  model: types.enumeration('TranscriptFeaturesOn', [
                    'cds',
                    'exon',
                  ]),
                  defaultValue: 'cds',
                  description: 'the transcript spans a row must lie in',
                },
                /**
                 * #slot transcriptFeatures.tracks.join
                 * Narrows a fit to the transcript the row names: its `field`
                 * equals the transcript's `transcriptField`. Unset, a row
                 * draws on every transcript it fits.
                 */
                join: ConfigurationSchema(
                  'TranscriptFeaturesJoin',
                  {
                    /**
                     * #slot transcriptFeatures.tracks.join.field
                     */
                    field: {
                      type: 'string',
                      defaultValue: '',
                      description: "row field naming the row's transcript",
                    },
                    /**
                     * #slot transcriptFeatures.tracks.join.transcriptField
                     * `id` for a GFF3, `name` for a GTF or a UCSC bigBed.
                     */
                    transcriptField: {
                      type: 'string',
                      defaultValue: 'id',
                      description: 'transcript field the row field equals',
                    },
                  },
                  { closed: true },
                ),
                /**
                 * #slot transcriptFeatures.tracks.filter
                 * Predicates a row passes to draw, as in the display's own
                 * `filter`, such as `{ field: 'status', equal: 'swissprot' }`.
                 */
                filter: types.stripDefault(fieldPredicateArray(), []),
              },
              { shorthand: 'track', writes: 'whole', closed: true },
            ),
          ),
          /**
           * #slot transcriptFeatures.encoding
           */
          encoding: ConfigurationSchema(
            'TranscriptFeaturesEncoding',
            {
              /**
               * #slot transcriptFeatures.encoding.color
               * The rows' color, an `encoding.color` object over the rows, by
               * `name` while it names no field or value. A dealt value skips
               * the colors that read as the CDS and UTR fills, so it can paint
               * differently here than on its own track.
               */
              color: colorConfigSchema,
            },
            { closed: true },
          ),
        },
        { shorthand: 'tracks', writes: 'whole', closed: true },
      ),
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
