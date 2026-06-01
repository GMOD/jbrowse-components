import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import { SHOW_LABELS_MODES, legacyShowLabelsToMode } from './showLabelsMode.ts'
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
      },
      /**
       * #slot
       */
      maxFeatureScreenDensity: {
        type: 'number',
        defaultValue: 1,
        description:
          'Maximum features per pixel before showing region too large message',
      },
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
      color1: {
        type: 'color',
        description: 'the main color of each feature',
        defaultValue: 'goldenrod',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      color2: {
        type: 'color',
        description:
          'the secondary color of each feature, used for connecting lines',
        defaultValue: THEME_DERIVED_COLOR,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      color3: {
        type: 'color',
        description: 'the tertiary color of each feature, used for UTRs',
        defaultValue: '#357089',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      outline: {
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
          'normal',
          'compact',
          'superCompact',
          'reducedRepresentation',
          'collapse',
        ]),
        description: 'Alternative display modes',
        defaultValue: 'normal',
      },
      /**
       * #slot
       */
      geneGlyphMode: {
        type: 'stringEnum',
        model: types.enumeration('geneGlyphMode', [
          'auto',
          'all',
          'longestCoding',
        ]),
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
        defaultValue: ['mRNA', 'transcript', 'primary_transcript'],
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
        description: 'imply UTR from the exon and CDS differences',
        defaultValue: false,
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
      // Lift renderer sub-config properties to display level for old configs
      // that used renderer: { type: "SvgFeatureRenderer"|"CanvasFeatureRenderer",
      // color1: ..., labels: ... }. The renderer concept was removed in the GPU
      // rewrite; these properties now live directly on the display config.
      preProcessSnapshot: (snap: Record<string, unknown>) => {
        const lifted =
          snap.renderer && typeof snap.renderer === 'object'
            ? (() => {
                const { type: _type, ...rendererProps } =
                  snap.renderer as Record<string, unknown>
                const { renderer: _renderer, ...rest } = snap
                return { ...rendererProps, ...rest }
              })()
            : snap
        // showLabels flipped from boolean to enum (auto/on/off). Old configs
        // (including the boolean lifted off a renderer above) need converting
        // so they pass schema validation.
        return typeof lifted.showLabels === 'boolean'
          ? { ...lifted, showLabels: legacyShowLabelsToMode(lifted.showLabels) }
          : lifted
      },
    },
  )
}
