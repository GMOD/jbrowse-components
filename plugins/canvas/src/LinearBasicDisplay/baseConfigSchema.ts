import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { colorConfigSchema } from '@jbrowse/display-kit/colorConfigSchema'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { densityTierConfigSchemaFields } from '@jbrowse/display-kit/densityTierConfigSchemaFields'
import { facetConfigSchema } from '@jbrowse/display-kit/facetConfigSchema'
import { heightModeConfigSchemaFields } from '@jbrowse/display-kit/heightModeConfigSchemaFields'
import { jexlFilterConfigSchemaFields } from '@jbrowse/display-kit/jexlFilterConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import { DISPLAY_MODES } from '../RenderFeatureDataRPC/renderConfig.ts'
import {
  MAX_DESCRIPTION_FEATURE_DENSITY,
  MAX_LABEL_FEATURE_DENSITY,
} from '../RenderFeatureDataRPC/zoomThresholds.ts'
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
        defaultHeightMode: 'fit',
        heightMode:
          'Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). `fit` (the default) keeps the track height and gives up descriptions, then isoforms, then names, then squeezes boxes down to 2px, and scrolls only what still overflows; `fixed` keeps a scrollable fixed height; `grow` expands the track to show all features. Orthogonal to the per-feature size set by `displayMode`, which fit never enlarges.',
        growMaxHeight:
          'Ceiling in pixels for the "autogrow track height" sizing mode; a track with more content than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes',
      }),
      ...densityTierConfigSchemaFields,
      ...jexlFilterConfigSchemaFields,
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
       * show the display's color key when it has one: the key a `color`
       * field derives, or a variant track's consequence-impact / SV-type
       * presets.
       */
      showLegend: {
        type: 'boolean',
        description: 'show the color key. Defaults to on',
        defaultValue: true,
      },
      /**
       * #slot
       */
      showLabels: {
        type: 'stringEnum',
        model: types.enumeration('showLabels', [...SHOW_LABELS_MODES]),
        description:
          'Which label text is drawn beside each feature: "auto" adapts to zoom, dropping descriptions at maxDescriptionFeatureDensity and names at maxLabelFeatureDensity; "nameAndDescription", "name", "description", and "none" pin a choice at every zoom. Defaults to `auto`. Replaces the former showLabels on/off enum + showDescriptions boolean pair',
        defaultValue: 'auto',
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
       * #slot color
       * The main fill of each feature: a CSS color or a jexl expression
       * (`"goldenrod"`, `"jexl:…"`), or `{ field, domain, range }` to paint
       * each value of a field its own `range` color, with a key.
       */
      color: colorConfigSchema,
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
        type: 'stringEnum',
        model: types.enumeration('displayMode', [...DISPLAY_MODES]),
        description:
          'Feature height preset, `normal` by default; `compact` and `superCompact` shrink the rows, and `collapsed` packs every feature onto a single row with all labels hidden',
        defaultValue: 'normal',
      },
      /**
       * #slot facet
       * One labelled section of the track per value of a field: `"strand"`,
       * or `{ field, domain }` with the order its sections stack in.
       */
      facet: facetConfigSchema,
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
