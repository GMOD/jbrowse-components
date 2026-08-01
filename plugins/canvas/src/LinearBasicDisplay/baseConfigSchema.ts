import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import {
  HEIGHT_MODE_VALUES,
  baseLinearDisplayConfigSchema,
} from '@jbrowse/plugin-linear-genome-view'

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
      // NOT a cap on the layout, and NOT the autogrow ceiling (that is
      // `growMaxHeight` below). It clamps `naturalContentHeight`, the settled
      // content height the grow ceiling is then applied to, so it only binds when
      // set below that ceiling. The packer has its own, separate limit —
      // GranularRectLayout's row limit — past which features are dropped entirely
      // (surfaced as truncatedFeatureCount). Three different limits, don't
      // conflate them.
      /**
       * #slot
       */
      maxHeight: {
        type: 'number',
        defaultValue: 1200,
        description:
          'Clamp in pixels on the content height this display reports (does not limit fixed or fit mode, where taller content scrolls). The autogrow ceiling is growMaxHeight',
        advanced: true,
      },
      /**
       * #slot
       */
      // `maxHeight` clamps `naturalContentHeight` first, so the effective grow
      // ceiling here is min(maxHeight, growMaxHeight) — raising this past
      // maxHeight alone changes nothing.
      growMaxHeight: {
        type: 'number',
        // literal so the generated config doc shows the number; pinned to the
        // shared GROW_MAX_HEIGHT default by a test, so it can't drift from the
        // alignments display's copy
        defaultValue: 800,
        description:
          'Ceiling in pixels for the "autogrow track height" sizing mode; a track with more content than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes. Raising it past maxHeight has no effect, since that clamps the content height first',
        advanced: true,
      },
      // maxFeatureScreenDensity is inherited from baseLinearDisplayConfigSchema
      // (default 1) — single source of truth for the density gate
      /**
       * #slot
       */
      heightMode: {
        type: 'maybeStringEnum',
        model: types.enumeration('heightMode', [...HEIGHT_MODE_VALUES]),
        description:
          'Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). Unset (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps a scrollable fixed height, `grow` expands the track to show all features, `fit` squeezes features to fill the current height. Orthogonal to the per-feature size set by `displayMode`. Unifies the former `autoHeight` (grow) + `squeezeToDisplayHeight` (fit) settings.',
        // Promotable sentinel slot (see promotableDefaults.ts / displayMode):
        // unset is the inherit state, `promotedBase` ('fixed') is what it
        // resolves to when nothing is promoted — so every real mode, `fixed`
        // included, is customizable back over a session default. Read through the
        // resolved `heightMode` getter (resolveConf), never raw.
        defaultValue: undefined,
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
          'Which label text is drawn beside each feature: "auto" adapts to zoom, dropping descriptions at maxDescriptionFeatureDensity and names at maxLabelFeatureDensity; "nameAndDescription", "name", "description", and "none" pin a choice at every zoom. Replaces the former showLabels on/off enum + showDescriptions boolean pair',
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
      // Main feature fill. Legacy configs used `color1` (auto-migrated).
      // `maybeColor` so "unset" stays distinct from every real color: unset
      // means a feature's own BED itemRgb paints it (else goldenrod), and with a
      // concrete default that behavior would swallow anyone writing that exact
      // color. The resolved values live in featureColors.ts, which the worker
      // applies. See maybeColor in configurationSlot.ts.
      color: {
        type: 'maybeColor',
        defaultValue: undefined,
        description:
          "the main fill color of each feature (a CSS color, or a jexl expression for per-feature coloring). Unset, a feature's own BED itemRgb paints it if it has one, else goldenrod",
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      // Connecting/intron lines between feature segments. Legacy: `color2`.
      // `maybeColor` for the same reason as `color` above: the default isn't a
      // color but "derive from the theme", and spending a real color (this once
      // defaulted to a `#f0f` sentinel) on that role made magenta connectors
      // unexpressible.
      connectorColor: {
        type: 'maybeColor',
        description:
          'color of the connecting/intron lines between feature segments (defaults to the theme text color)',
        defaultValue: undefined,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      // Fill color for UTRs on gene/transcript glyphs. Legacy: `color3`.
      // `maybeColor` for the same reason as `color` above.
      utrColor: {
        type: 'maybeColor',
        defaultValue: undefined,
        description:
          "fill color for UTRs on gene/transcript glyphs. Unset, a feature's own BED itemRgb paints them too (matching UCSC's whole-item coloring), else a contrasting blue",
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
        type: 'maybeStringEnum',
        model: types.enumeration('displayMode', [...DISPLAY_MODES]),
        description:
          'Feature height preset. Unset (the default) follows the session-wide default for this display type, falling back to `normal`; `normal`/`compact`/`superCompact` customize the track explicitly (including customizing `normal` back over a `compact` session default); `collapsed` packs every feature onto a single row with all labels hidden',
        // Promotable sentinel slot (see promotableDefaults.ts / subfeatureLabels):
        // unset is the inherit state, `promotedBase` ('normal') is what it
        // resolves to when nothing is promoted — so every real preset, `normal`
        // included, is customizable. Legacy stored normal/compact/superCompact are
        // still valid members (customized values), so no snapshot migration is needed. Read
        // through the resolved `displayMode` getter (resolveConf), never raw.
        defaultValue: undefined,
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
        type: 'maybeStringEnum',
        model: types.enumeration('subfeatureLabels', [...SUBFEATURE_LABELS]),
        description:
          'subfeature label display mode. Unset (the default) follows the session-wide default for this display type, falling back to `none`; `none`/`below`/`overlay` customize the track explicitly',
        // Promotable sentinel enum (see promotableDefaults.ts / displayMode):
        // unset is the inherit state, `promotedBase` ('none') is what it
        // resolves to when nothing is promoted. Legacy stored none/below/overlay
        // are still valid members (customized values), so no snapshot migration is needed.
        // Read through the resolved `subfeatureLabels` getter (resolveConf),
        // never raw.
        defaultValue: undefined,
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
        // resolved `displayDirectionalChevrons` getter (resolveConf), never
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

export type LinearCanvasBaseDisplayConfigModel = ReturnType<
  typeof baseConfigSchemaFactory
>
