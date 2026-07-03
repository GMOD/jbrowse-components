import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import { GENE_GLYPH_MODES } from './geneGlyphMode.ts'
import { migrateBasicConfigSnapshot } from './migrateBasicSnapshot.ts'
import { SHOW_LABELS_MODES } from './showLabelsMode.ts'
import { THEME_DERIVED_COLOR } from '../RenderFeatureDataRPC/renderConfig.ts'
import { MAX_LABEL_FEATURE_DENSITY } from '../RenderFeatureDataRPC/zoomThresholds.ts'

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
      /**
       * #slot
       */
      maxHeight: {
        type: 'number',
        defaultValue: 1200,
        description: 'Maximum height of the display in pixels',
        advanced: true,
      },
      // maxFeatureScreenDensity is inherited from baseLinearDisplayConfigSchema
      // (default 1) — single source of truth for the density gate
      /**
       * #slot
       */
      autoHeight: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Automatically resize the track height to fit all features',
      },
      /**
       * #slot
       */
      showLabels: {
        type: 'stringEnum',
        model: types.enumeration('showLabels', [...SHOW_LABELS_MODES]),
        defaultValue: 'auto',
        description:
          'Show feature labels: "auto" hides labels at high feature density, "on" always shows, "off" always hides',
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
      showDescriptions: {
        type: 'boolean',
        defaultValue: true,
        description: 'Show feature descriptions',
      },
      /**
       * #slot
       */
      // Main feature fill. Legacy configs used `color1` (auto-migrated).
      color: {
        type: 'color',
        description:
          'the main fill color of each feature (a CSS color, or a jexl expression for per-feature coloring)',
        defaultValue: 'goldenrod',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      // Connecting/intron lines between feature segments. Legacy: `color2`.
      connectorColor: {
        type: 'color',
        description:
          'color of the connecting/intron lines between feature segments (defaults to the theme text color)',
        defaultValue: THEME_DERIVED_COLOR,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      // Fill color for UTRs on gene/transcript glyphs. Legacy: `color3`.
      utrColor: {
        type: 'color',
        description: 'fill color for UTRs on gene/transcript glyphs',
        defaultValue: '#357089',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      // Legacy configs used `outline` (auto-migrated to outlineColor).
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
        type: 'stringEnum',
        model: types.enumeration('displayMode', [
          'inherit',
          'normal',
          'compact',
          'superCompact',
        ]),
        description:
          'Feature height preset. `inherit` (the default) follows the session-wide default for this display type, falling back to `normal`; `normal`/`compact`/`superCompact` each pin an explicit height (including pinning `normal` over a compact session default)',
        // `inherit` is the CSS-style sentinel default (the un-pinned state);
        // `promotedBase` ('normal') is what it resolves to when nothing is
        // promoted. See promotableDefaults.ts.
        defaultValue: 'inherit',
        promotedBase: 'normal',
        promotable: true,
      },
      /**
       * #slot
       */
      geneGlyphMode: {
        type: 'stringEnum',
        model: types.enumeration('geneGlyphMode', [...GENE_GLYPH_MODES]),
        description:
          'Gene glyph display mode: "auto" switches based on zoom level, "all" shows all transcripts, "longestCoding" shows only the longest coding transcript',
        defaultValue: 'auto',
      },
      /**
       * #slot
       */
      subfeatureLabels: {
        type: 'stringEnum',
        model: types.enumeration('subfeatureLabels', [
          'none',
          'below',
          'overlay',
        ]),
        description: 'subfeature label display mode',
        defaultValue: 'none',
      },
      /**
       * #slot
       */
      displayDirectionalChevrons: {
        type: 'boolean',
        description:
          'Display directional chevrons on intron lines to indicate strand direction',
        defaultValue: true,
      },
      /**
       * #slot
       */
      transcriptTypes: {
        type: 'stringArray',
        // No longer gates glyph choice, UTR synthesis, or peptide translation —
        // those are structural (any feature with a direct CDS child is a coding
        // transcript), so org-specific/prokaryotic coding types render correctly
        // without being listed. This now only tunes isoform stacking/label
        // spacing (subfeatures.ts) and the gene-only view (featureAdmission.ts);
        // V/C/D/J_gene_segment are kept so NCBI immunoglobulin/TCR segments are
        // treated as transcripts there too.
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
      labels: ConfigurationSchema('CanvasFeatureLabels', {
        name: {
          type: 'string',
          description: 'the primary name of the feature to show',
          defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
          contextVariable: ['feature'],
        },
        description: {
          type: 'string',
          description: 'the text description to show',
          defaultValue: `jexl:get(feature,'note') || get(feature,'description')`,
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
      // Old-config back-compat (renderer sub-config lift + legacy enum
      // normalization) lives in migrateBasicSnapshot.ts.
      preProcessSnapshot: snap => migrateBasicConfigSnapshot(snap),
    },
  )
}
