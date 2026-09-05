import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { densityTierConfigSchemaFields } from '@jbrowse/display-kit/densityTierConfigSchemaFields'
import { heightModeConfigSchemaFields } from '@jbrowse/display-kit/heightModeConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import {
  DISPLAY_MODES,
  SUBFEATURE_LABELS,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import {
  MAX_DESCRIPTION_FEATURE_DENSITY,
  MAX_LABEL_FEATURE_DENSITY,
} from '../RenderFeatureDataRPC/zoomThresholds.ts'
import { GENE_GLYPH_MODES } from './geneGlyphMode.ts'
import { migrateBasicConfigSnapshot } from './migrateBasicSnapshot.ts'
import { SHOW_LABELS_MODES } from './showLabelsMode.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearCanvasBaseDisplay
 * #category display
 * base config for canvas-based linear feature displays (pileup-style glyphs)
 */
export default function baseConfigSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearCanvasBaseDisplay',
    {
      // `growMaxHeight` is the only height ceiling; a former `maxHeight` slot
      // was a second grow clamp dead at its default, dropped in
      // `migrateBasicConfigSnapshot`.
      ...heightModeConfigSchemaFields({
        heightMode:
          'Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). Unset (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps a scrollable fixed height, `grow` expands the track to show all features, `fit` squeezes features to fill the current height. Orthogonal to the per-feature size set by `displayMode`. Unifies the former `autoHeight` (grow) + `squeezeToDisplayHeight` (fit) settings.',
        growMaxHeight:
          'Ceiling in pixels for the "autogrow track height" sizing mode; a track with more content than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes',
      }),
      ...densityTierConfigSchemaFields,
      // Not a fallback for the byte axis: an index size cannot tell a few
      // large features from many tiny ones.
      /**
       * #slot
       */
      maxFeatureScreenDensity: {
        type: 'number',
        description:
          'maximum features per pixel before showing a "too many features" message',
        defaultValue: 1,
        advanced: true,
      },
      /**
       * #slot
       * show the display's color key when it has one (the `legend` slot, or a
       * variant track's consequence-impact / SV-type presets).
       */
      showLegend: {
        type: 'maybeBoolean',
        description:
          'show the color key. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track',
        promotedBase: true,
      },
      /**
       * #slot
       */
      showLabels: {
        type: 'maybeStringEnum',
        model: types.enumeration('showLabels', [...SHOW_LABELS_MODES]),
        description:
          'Which label text is drawn beside each feature: "auto" adapts to zoom, dropping descriptions at maxDescriptionFeatureDensity and names at maxLabelFeatureDensity; "nameAndDescription", "name", "description", and "none" pin a choice at every zoom. Unset (the default) follows the session-wide default for this display type, falling back to `auto`. Replaces the former showLabels on/off enum + showDescriptions boolean pair',
        // A promotable sentinel enum: unset inherits and `promotedBase` is
        // the resolved default, so every rung, `auto` included, stays
        // customizable back over an opposite session default.
        promotedBase: 'auto',
      },
      /**
       * #slot
       */
      maxLabelFeatureDensity: {
        type: 'number',
        defaultValue: MAX_LABEL_FEATURE_DENSITY,
        description:
          'In "auto" showLabels mode, hide labels when visible feature density (features/pixel) exceeds this value',
        advanced: true,
      },
      /**
       * #slot
       */
      maxDescriptionFeatureDensity: {
        type: 'number',
        defaultValue: MAX_DESCRIPTION_FEATURE_DENSITY,
        description:
          'In "auto" showLabels mode, hide descriptions when visible feature density (features/pixel) exceeds this value. Lower than maxLabelFeatureDensity so descriptions drop before names',
        advanced: true,
      },
      /**
       * #slot
       */
      // `maybeColor` so unset stays distinct from every real color: unset
      // means a feature's own itemRgb paints it, and a concrete default would
      // swallow anyone writing that exact color.
      color: {
        type: 'maybeColor',
        description:
          "the main fill color of each feature (a CSS color, or a jexl expression for per-feature coloring). Unset, a feature's own BED itemRgb paints it if it has one, else goldenrod",
        contextVariable: ['feature'],
      },
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
      outlineColor: {
        type: 'color',
        description: 'outline color for features (empty string = no outline)',
        defaultValue: '',
      },
      /**
       * #slot
       */
      featureHeight: {
        type: 'number',
        description: 'height in pixels of the main body of each feature',
        defaultValue: 10,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      displayMode: {
        type: 'maybeStringEnum',
        model: types.enumeration('displayMode', [...DISPLAY_MODES]),
        description:
          'Feature height preset. Unset (the default) follows the session-wide default for this display type, falling back to `normal`; `normal`/`compact`/`superCompact` customize the track explicitly (including customizing `normal` back over a `compact` session default); `collapsed` packs every feature onto a single row with all labels hidden',
        promotedBase: 'normal',
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
        type: 'maybeStringEnum',
        model: types.enumeration('subfeatureLabels', [...SUBFEATURE_LABELS]),
        description:
          'subfeature label display mode. Unset (the default) follows the session-wide default for this display type, falling back to `none`; `none`/`below`/`overlay` customize the track explicitly',
        promotedBase: 'none',
      },
      /**
       * #slot
       */
      displayDirectionalChevrons: {
        type: 'maybeBoolean',
        description:
          'Display directional chevrons on intron lines to indicate strand direction. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track (including customizing on over an off session default)',
        promotedBase: true,
      },
      /**
       * #slot
       * feature types admitted by the gene-only view (`showOnlyGenes`), plus
       * the fallback for recognizing a CHILDLESS transcript as one of a
       * gene's isoforms.
       */
      transcriptTypes: {
        type: 'stringArray',
        // Not the isoform test: keying that off this list dropped every
        // `lnc_RNA`/`misc_RNA` isoform NCBI hangs off a gene, so the list is
        // only the childless-transcript fallback and the gene-only gate.
        defaultValue: [
          'mRNA',
          'transcript',
          'primary_transcript',
          'V_gene_segment',
          'C_gene_segment',
          'D_gene_segment',
          'J_gene_segment',
        ],
      },
      /**
       * #slot
       * feature attribute carrying an isoform's curated "this one represents
       * the gene" tag.
       */
      canonicalTranscriptField: {
        type: 'string',
        defaultValue: 'tag',
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
        defaultValue: [
          'MANE Select',
          'MANE_Select',
          'RefSeq Select',
          'Ensembl_canonical',
          'MANE Plus Clinical',
          'MANE_Plus_Clinical',
        ],
      },
      /**
       * #slot
       * top-level feature types that always stack their children on separate
       * rows.
       */
      containerTypes: {
        type: 'stringArray',
        defaultValue: ['proteoform_orf'],
      },
      /**
       * #slot
       */
      subParts: {
        type: 'string',
        description: 'subparts for a glyph',
        defaultValue: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
      },
      /**
       * #slot
       */
      impliedUTRs: {
        type: 'boolean',
        description:
          'imply UTRs from exon/CDS differences on transcript glyphs that carry no explicit UTR subfeatures',
        defaultValue: true,
      },
      /**
       * #slot
       */
      hideSourceFeatures: {
        type: 'boolean',
        description:
          'hide the GFF3 source record, the whole-molecule type=region feature NCBI RefSeq emits per sequence (gbkey=Src). It spans the entire chromosome and carries only taxon/strain metadata, so it draws as a bar across every window. Set false to draw it. No effect on files that carry no gbkey attribute',
        defaultValue: true,
      },
      labels: ConfigurationSchema('CanvasFeatureLabels', {
        /**
         * #slot labels.name
         */
        name: {
          type: 'string',
          description: 'the primary name of the feature to show',
          defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
          contextVariable: ['feature'],
        },
        /**
         * #slot labels.description
         */
        description: {
          type: 'string',
          description: 'the text description to show',
          // `function` is the only human-readable text on structural features
          // that carry no note; read via get() since it is a reserved word in
          // the grammar.
          defaultValue: `jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')`,
          contextVariable: ['feature'],
        },
      }),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
      preProcessSnapshot: snap => migrateBasicConfigSnapshot(snap),
    },
  )
}

export type LinearCanvasBaseDisplayConfigModel = ReturnType<
  typeof baseConfigSchemaFactory
>
