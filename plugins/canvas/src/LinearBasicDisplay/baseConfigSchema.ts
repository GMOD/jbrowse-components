import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
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
      // NOT a cap on the layout, and NOT the autogrow ceiling (that is
      // `growMaxHeight` below). It is the outer clamp on `growTargetHeight`, the
      // content height the grow ceiling is then applied to, so it binds only in
      // grow mode and only when set below that ceiling. The packer has its own,
      // separate limit — GranularRectLayout's row limit — past which features are
      // dropped entirely (surfaced as truncatedFeatureCount). Three different
      // limits, don't conflate them.
      /**
       * #slot
       */
      maxHeight: {
        type: 'number',
        defaultValue: 1200,
        description:
          'Outer clamp in pixels on the content height the "autogrow track height" mode sizes to. Applies to no other mode — fixed and fit keep their configured height and scroll taller content. The autogrow ceiling proper is growMaxHeight, which is lower by default, so this only binds when set below it',
        advanced: true,
      },
      // `maxHeight` above clamps `growTargetHeight` first, so the effective grow
      // ceiling is min(maxHeight, growMaxHeight) — raising `growMaxHeight` past
      // `maxHeight` alone changes nothing.
      ...heightModeConfigSchemaFields({
        heightMode:
          'Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). Unset (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps a scrollable fixed height, `grow` expands the track to show all features, `fit` squeezes features to fill the current height. Orthogonal to the per-feature size set by `displayMode`. Unifies the former `autoHeight` (grow) + `squeezeToDisplayHeight` (fit) settings.',
        growMaxHeight:
          'Ceiling in pixels for the "autogrow track height" sizing mode; a track with more content than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes. Raising it past maxHeight has no effect, since that clamps the content height first',
      }),
      // maxFeatureScreenDensity is inherited from baseLinearDisplayConfigSchema
      // (default 1) — single source of truth for the density gate
      /**
       * #slot
       * show the display's color key when it has one (the `legend` slot, or a
       * variant track's consequence-impact / SV-type presets). Unset (the
       * default) follows the session-wide default for this display type,
       * falling back to on; an explicit true/false customizes the track
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
        // Promotable sentinel enum (see promotableDefaults.ts / displayMode):
        // unset is the inherit state and `promotedBase` ('auto') is what it
        // resolves to when nothing is promoted, so every rung — 'auto' included
        // — stays customizable back over an opposite session default. Legacy
        // values are folded onto a concrete member by
        // `migrateBasicConfigSnapshot`, which fires only on a legacy shape, so a
        // config that never carried one is left unset and follows the cascade.
        // Read through the resolved `showLabelsMode` getter (resolveConf).
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
      // Main feature fill. Legacy configs used `color1` (auto-migrated).
      // `maybeColor` so "unset" stays distinct from every real color: unset
      // means a feature's own BED itemRgb paints it (else goldenrod), and with a
      // concrete default that behavior would swallow anyone writing that exact
      // color. The resolved values live in featureColors.ts, which the worker
      // applies. See maybeColor in configurationSlot.ts.
      color: {
        type: 'maybeColor',
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
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      // Fill color for UTRs on gene/transcript glyphs. Legacy: `color3`.
      // `maybeColor` for the same reason as `color` above.
      utrColor: {
        type: 'maybeColor',
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
        promotedBase: 'normal',
      },
      /**
       * #slot
       */
      geneGlyphMode: {
        type: 'stringEnum',
        model: types.enumeration('geneGlyphMode', [...GENE_GLYPH_MODES]),
        description:
          'Gene glyph display mode: "auto" switches based on zoom level, "all" shows all transcripts, "longestCoding" shows one transcript per gene — the one canonicalTranscriptTags names, else the longest coding',
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
        promotedBase: 'none',
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
        promotedBase: true,
      },
      /**
       * #slot
       * feature types admitted by the gene-only view (`showOnlyGenes`), plus
       * the fallback for recognizing a CHILDLESS transcript as one of a gene's
       * isoforms. It does not decide which glyph is drawn, whether UTRs are
       * implied, whether a feature can be translated, or — for a transcript
       * with subfeatures, which is nearly all of them — whether it is an
       * isoform or gets a label row. Those are all structural (anything with a
       * direct CDS child is a coding transcript; anything with children of its
       * own takes a row), so org-specific and prokaryotic types render
       * correctly without being listed here.
       */
      transcriptTypes: {
        type: 'stringArray',
        // Deliberately NOT the isoform test: keying that off this list left
        // every `lnc_RNA`/`misc_RNA` isoform NCBI hangs off a gene out of the
        // ranking and dropped by longestCoding (see subfeatures.ts
        // `isIsoform`), so the list survives only as the childless-transcript
        // fallback there and as the gene-only view's own gate.
        // V/C/D/J_gene_segment are kept so NCBI immunoglobulin/TCR segments are
        // admitted by that view too.
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
       * the gene" tag. NCBI's GFF3 puts `RefSeq Select` / `MANE Select` in
       * `tag`, and so do Ensembl and GENCODE (`Ensembl_canonical`,
       * `MANE_Select`) — an annotation that names it somewhere else says so
       * here. GFF3 attribute names reach a feature lowercased.
       */
      canonicalTranscriptField: {
        type: 'string',
        defaultValue: 'tag',
      },
      /**
       * #slot
       * values of that attribute that mark an isoform as the gene's
       * representative one, which is then ranked ahead of every other isoform:
       * it is the transcript shown by `longestCoding`, and the first kept when
       * `auto` caps a gene at the rows the track has. Matched
       * case-insensitively, against a multi-valued attribute member-wise
       * (`tag=MANE Select,RefSeq Select`). Ordered best-first, because a gene
       * can carry two of these at once: `MANE Plus Clinical` marks an
       * ADDITIONAL transcript beside the `MANE Select` one and is often the
       * longer, so it sorts last and the coding-length ranking below never gets
       * to break that tie the wrong way. NCBI and Ensembl/GENCODE both emit the
       * MANE tags and spell them differently — spaces in NCBI's GFF3,
       * underscores in GENCODE's — so `MANE Select` and `MANE Plus Clinical`
       * are each listed twice. `RefSeq Select` comes from NCBI alone and
       * `Ensembl_canonical` from Ensembl/GENCODE alone, so one spelling serves
       * each. Empty turns the whole rule off.
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
       * rows. Container detection is otherwise structural — a feature whose
       * children have children of their own stacks anyway — so this is only
       * needed for a type whose children look like leaves but should still
       * each get a row.
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
