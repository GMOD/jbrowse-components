import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { featureEncodingConfigSchema } from '@jbrowse/display-kit/featureEncodingConfigSchema'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'
import { heightModeConfigSchemaFields } from '@jbrowse/display-kit/heightModeConfigSchemaFields'
import { legendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { sectionFacetConfigSchema } from '@jbrowse/display-kit/sectionFacetConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { DISPLAY_MODES } from '../RenderFeatureDataRPC/renderConfig.ts'
import { featureGateConfigSchemaFields } from '../shared/featureGateConfigSchemaFields.ts'
import { featureDescriptionLabelConfigSchema } from './featureDescriptionLabelConfigSchema.ts'
import { featureMarkConfigSchema } from './featureMarkConfigSchema.ts'
import { featureNameLabelConfigSchema } from './featureNameLabelConfigSchema.ts'
import { featureTooltipConfigSchema } from './featureTooltipConfigSchema.ts'
import {
  basicRetired,
  migrateBasicConfigSnapshot,
} from './migrateBasicSnapshot.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearFeatureBaseDisplay
 * #category display
 * Holds the slots shared by the canvas-drawn linear feature displays, which
 * stack overlapping features in rows (pileup-style glyphs).
 */
export default function baseConfigSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearFeatureBaseDisplay',
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
       * `transcripts.types` and `containers.types`, and a top-level CDS.
       */
      filter: fieldPredicateList(),
      // Not a fallback for the byte axis: an index size cannot tell a few
      // large features from many tiny ones.
      /**
       * #slot
       * The box hovering a feature opens, a [](/docs/config/featuretooltip)
       * object.
       */
      tooltip: featureTooltipConfigSchema,
      ...featureGateConfigSchemaFields,
      /**
       * #slot legend
       * The display's color key, when it has one: the key an
       * `encoding.color` field derives, or a variant track's
       * consequence-impact / SV-type presets.
       */
      legend: legendConfigSchema,
      /**
       * #slot encoding
       * The channels the features paint through: `encoding.color`, each
       * feature's main fill.
       */
      encoding: featureEncodingConfigSchema,
      /**
       * #slot
       * The box each feature draws as, a [](/docs/config/featuremark)
       * object: `{ height: 6 }`.
       */
      mark: featureMarkConfigSchema,
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
       * The text drawn beside each feature, two parts with `show`.
       */
      labels: ConfigurationSchema(
        'CanvasFeatureLabels',
        {
          /**
           * #slot labels.name
           * Each feature's name, a [](/docs/config/featurenamelabel) object.
           */
          name: featureNameLabelConfigSchema,
          /**
           * #slot labels.description
           * The line under each name, a
           * [](/docs/config/featuredescriptionlabel) object.
           */
          description: featureDescriptionLabelConfigSchema,
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
      retired: basicRetired,
      preProcessSnapshot: snap => migrateBasicConfigSnapshot(snap),
    },
  )
}

export type LinearFeatureBaseDisplayConfigModel = ReturnType<
  typeof baseConfigSchemaFactory
>
