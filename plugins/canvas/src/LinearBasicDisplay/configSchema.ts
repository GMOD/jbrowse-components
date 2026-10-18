import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import {
  GENE_GLYPH_DEFAULTS,
  SUBFEATURE_LABELS,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import baseConfigSchemaFactory from './baseConfigSchema.ts'
import { basicFeatureFilterConfigSchema } from './basicFeatureFilterConfigSchema.ts'
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
       * #slot filter
       * The features the display draws: the jexl `expressions`, and `genes`,
       * the gene-like features as a category.
       */
      filter: basicFeatureFilterConfigSchema,
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
          'subfeature label display mode: `none` (the default), `below` or `overlay`',
        defaultValue: GENE_GLYPH_DEFAULTS.subfeatureLabels,
      },
      /**
       * #slot
       */
      showChevrons: {
        type: 'boolean',
        description:
          'draw chevrons on intron lines pointing the way the feature reads',
        defaultValue: true,
      },
      /**
       * #slot
       * feature types the gene category (`filter.genes`) counts beside
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
       * feature attribute carrying an isoform's curated "this one represents
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
       * #slot
       */
      impliedUTRs: {
        type: 'boolean',
        description:
          'draw the stretch of each exon outside the CDS that no UTR row covers as a UTR, or with no exon rows, a CDS end no UTR row reaches out to the transcript bounds',
        defaultValue: GENE_GLYPH_DEFAULTS.impliedUTRs,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
      // v4.3.0's name for `showChevrons`
      retired: {
        displayDirectionalChevrons: showChevrons => ({ showChevrons }),
      },
    },
  )
}

// The schema type is what a state model factory annotates its `configSchema`
// param with, the only lever that narrows that model's config reads.
export type LinearBasicDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearBasicDisplayConfig = Instance<LinearBasicDisplayConfigModel>
