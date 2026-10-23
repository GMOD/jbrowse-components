import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { featureEncodingConfigSchema } from '@jbrowse/display-kit/featureEncodingConfigSchema'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'
import { heightModeConfigSchemaFields } from '@jbrowse/display-kit/heightModeConfigSchemaFields'
import { legendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { retiredDisplayColor } from '@jbrowse/display-kit/retiredSettings'
import { sectionFacetConfigSchema } from '@jbrowse/display-kit/sectionFacetConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { DEFAULT_MOUSEOVER } from '../RenderFeatureDataRPC/featureMouseover.ts'
import { FEATURE_NAME_FIELD } from '../RenderFeatureDataRPC/featureNameField.ts'
import { DISPLAY_MODES } from '../RenderFeatureDataRPC/renderConfig.ts'
import {
  MAX_DESCRIPTION_FEATURE_DENSITY,
  MAX_LABEL_FEATURE_DENSITY,
} from '../RenderFeatureDataRPC/zoomThresholds.ts'
import {
  basicRetired,
  migrateBasicConfigSnapshot,
} from './migrateBasicSnapshot.ts'
import { SHOW_LABELS_MODES } from './showLabelsMode.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearCanvasBaseDisplay
 * #category display
 * Holds the slots shared by the canvas-drawn linear feature displays, which
 * stack overlapping features in rows (pileup-style glyphs).
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
      /**
       * #slot filter
       * The features the display draws, a list of
       * [](/docs/config/fieldpredicate) entries a feature must all pass: a
       * field of the feature's own (`{ field: "score", gte: 100 }`), a `jexl:`
       * expression that must hold (`"jexl:feature.type == 'gene'"`), or
       * `geneLike`, true for every gene, transcript and RNA type, the
       * `transcriptTypes` and `containerTypes`, and a top-level CDS.
       */
      filter: fieldPredicateList(),
      // Not a fallback for the byte axis: an index size cannot tell a few
      // large features from many tiny ones.
      /**
       * #slot
       */
      mouseover: {
        type: 'string',
        description:
          'text to display when the cursor hovers over a feature; left at the default, the tooltip adds the description line (`labels.description`) as a second row',
        defaultValue: DEFAULT_MOUSEOVER,
        contextVariable: ['feature'],
      },
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
       * #slot legend
       * The display's color key, when it has one: the key an
       * `encoding.color` field derives, or a variant track's
       * consequence-impact / SV-type presets.
       */
      legend: legendConfigSchema,
      /**
       * #slot
       */
      showLabels: {
        type: 'stringEnum',
        model: types.enumeration('showLabels', [...SHOW_LABELS_MODES]),
        description:
          'Label text drawn beside each feature: "auto" adapts to zoom, dropping descriptions at maxDescriptionFeatureDensity and names at maxLabelFeatureDensity; "nameAndDescription", "name", "description", and "none" pin a choice at every zoom. Defaults to `auto`. Replaces the former showLabels on/off enum + showDescriptions boolean pair',
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
       * #slot encoding
       * The channels the features paint through: `encoding.color`, each
       * feature's main fill.
       */
      encoding: featureEncodingConfigSchema,
      /**
       * #slot
       */
      showOutline: {
        type: 'boolean',
        description: 'draw an outline around each feature',
        defaultValue: false,
      },
      /**
       * #slot
       */
      outlineColor: {
        type: 'maybeColor',
        description:
          "the outline's color while showOutline draws one; unset takes the theme's",
      },
      /**
       * #slot
       */
      featureHeight: {
        type: 'number',
        description:
          'height in pixels of the main body of each feature in the normal display mode; compact draws it at 0.6 of this and superCompact at 0.3',
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
       * or `{ field, sort }` with the order its sections stack in.
       */
      facet: sectionFacetConfigSchema,
      /**
       * #slot labels
       * The fields a feature's name label and description line read.
       */
      labels: ConfigurationSchema(
        'CanvasFeatureLabels',
        {
          /**
           * #slot labels.name
           */
          name: {
            type: 'featureField',
            description:
              "the field each feature's name label reads, such as `gene_name`, or a `jexl:` expression over `feature`; the default reads the name, else the ID, and an empty value draws no name",
            defaultValue: FEATURE_NAME_FIELD,
          },
          /**
           * #slot labels.description
           */
          description: {
            type: 'featureField',
            description:
              "the field each feature's description line reads, such as `note`, or a `jexl:` expression over `feature`; the default reads `note`, else `description`, else `function`, and an empty value draws no description",
            // `function` is the only human-readable text on structural features
            // that carry no note; read via get() since it is a reserved word in
            // the grammar.
            defaultValue: `jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')`,
          },
        },
        { plot: true },
      ),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
      retired: { ...basicRetired, ...retiredDisplayColor },
      preProcessSnapshot: snap => migrateBasicConfigSnapshot(snap),
    },
  )
}

export type LinearCanvasBaseDisplayConfigModel = ReturnType<
  typeof baseConfigSchemaFactory
>
