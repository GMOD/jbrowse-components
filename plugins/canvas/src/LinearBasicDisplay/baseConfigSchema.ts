import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import {
  HEIGHT_MODE_VALUES,
  baseLinearDisplayConfigSchema,
} from '@jbrowse/plugin-linear-genome-view'

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
      heightMode: {
        type: 'stringEnum',
        model: types.enumeration('heightMode', [...HEIGHT_MODE_VALUES]),
        description:
          'Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). `inherit` (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps a scrollable fixed height, `grow` expands the track to show all features, `fit` squeezes features to fill the current height. Orthogonal to the per-feature size set by `displayMode`. Unifies the former `autoHeight` (grow) + `squeezeToDisplayHeight` (fit) settings.',
        // Sentinel promotable slot (see promotableDefaults.ts / displayMode):
        // `inherit` is the inherit state, `promotedBase` ('fixed') is what it
        // resolves to when nothing is promoted — so every real mode, `fixed`
        // included, is customizable back over a session default. Read through the
        // resolved `heightMode` getter (getConfResolved), never raw.
        defaultValue: 'inherit',
        promotedBase: 'fixed',
        promotable: true,
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
          'Feature height preset. `inherit` (the default) follows the session-wide default for this display type, falling back to `normal`; `normal`/`compact`/`superCompact` customize the track explicitly (including customizing `normal` back over a `compact` session default)',
        // Sentinel promotable slot (see promotableDefaults.ts / subfeatureLabels):
        // `inherit` is the inherit state, `promotedBase` ('normal') is what it
        // resolves to when nothing is promoted — so every real preset, `normal`
        // included, is customizable. Legacy stored normal/compact/superCompact are
        // still valid members (customized values), so no snapshot migration is needed. Read
        // through the resolved `displayMode` getter (getConfResolved), never raw.
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
          'inherit',
          'none',
          'below',
          'overlay',
        ]),
        description:
          'subfeature label display mode. `inherit` (the default) follows the session-wide default for this display type, falling back to `none`; `none`/`below`/`overlay` customize the track explicitly',
        // Promotable sentinel enum (see promotableDefaults.ts / displayMode):
        // `inherit` is the inherit state, `promotedBase` ('none') is what it
        // resolves to when nothing is promoted. Legacy stored none/below/overlay
        // are still valid members (customized values), so no snapshot migration is needed.
        // Read through the resolved `subfeatureLabels` getter (getConfResolved),
        // never raw.
        defaultValue: 'inherit',
        promotedBase: 'none',
        promotable: true,
      },
      /**
       * #slot
       */
      displayDirectionalChevrons: {
        type: 'maybeBoolean',
        description:
          'Display directional chevrons on intron lines to indicate strand direction. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track (including customizing on over an off session default)',
        // Promotable via the `maybeBoolean` sentinel: `undefined` (unset) is the
        // inherit state, `promotedBase` (true) is what it resolves to when
        // nothing is promoted. A legacy stored boolean is already a valid
        // customized value, so no snapshot migration is needed. Read through the
        // resolved `displayDirectionalChevrons` getter (getConfResolved), never
        // raw. See promotableDefaults.ts.
        defaultValue: undefined,
        promotedBase: true,
        promotable: true,
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
          // `function` (the INSDC/GFF3 qualifier, kept lowercase by the GFF
          // adapter) is the only human-readable text on structural/regulatory
          // features that carry no note — e.g. an NCBI viral `stem_loop`
          // ("Coronavirus frameshifting stimulation element stem-loop 1").
          // Read via get() since `function` is a reserved word in the grammar.
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
      // Old-config back-compat (renderer sub-config lift + legacy enum
      // normalization) lives in migrateBasicSnapshot.ts.
      preProcessSnapshot: snap => migrateBasicConfigSnapshot(snap),
    },
  )
}
