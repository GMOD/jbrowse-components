import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import {
  arcColorSchema,
  arcLegendConfigSchemaFields,
} from '../shared/arcColorConfigSchema.ts'
import { scoreFilterConfigSchemaFields } from '../shared/scoreFilter.ts'
import { ARC_DISPLAY_MODES } from './displayModes.ts'
import { migrateLegacyArcRendererConfig } from './migrate.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearArcDisplay
 *
 * #example
 * Selected on a `FeatureTrack`; each feature is drawn as one arc from its start
 * to its end. `displayMode` is `arcs` (bezier) or `semicircles`. The
 * `thickness` and `label` slots default to expressions over the feature
 * `score`, so override them (plus `color` / `arcHeight`) for data without a
 * score. The style slots are jexl-evaluated per feature, and `color` also
 * takes a field with a scale and a key, `{ field: 'strand' }`
 * ([ArcColor](../arccolor)):
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'interactions',
 *   name: 'Interactions',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'Gff3TabixAdapter',
 *     uri: 'https://example.com/interactions.gff3.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearArcDisplay',
 *       displayId: 'interactions-LinearArcDisplay',
 *       displayMode: 'semicircles',
 *       color: "jexl:feature.strand==-1?'red':'blue'",
 *       arcHeight: 80,
 *       label: "jexl:feature.name",
 *     },
 *   ],
 * }
 * ```
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearArcDisplay',
    {
      ...trackHeightConfigSchemaFields(),
      /**
       * #slot color
       * The arcs' colour: a CSS colour, a jexl callback over `feature`, or a
       * field bound to a categorical or threshold scale, which the key
       * describes.
       */
      color: arcColorSchema,
      ...arcLegendConfigSchemaFields,
      /**
       * #slot
       */
      thickness: {
        type: 'number',
        description:
          'the thickness of the arcs, in pixels; an arc given 0 or less is not drawn at all',
        defaultValue: `jexl:logThickness(feature,'score')`,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      label: {
        type: 'string',
        description: 'the label to appear at the apex of the arcs',
        defaultValue: `jexl:get(feature,'score')`,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      arcHeight: {
        type: 'number',
        description: 'the height of the arcs',
        defaultValue: `jexl:log10(get(feature,'end')-get(feature,'start'))*50`,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      caption: {
        type: 'string',
        description:
          'the caption to appear when hovering over any point on the arcs',
        defaultValue: `jexl:get(feature,'name')`,
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      displayMode: {
        type: 'stringEnum',
        defaultValue: 'arcs',
        model: types.enumeration('DisplayMode', [...ARC_DISPLAY_MODES]),
        description: 'render semi-circles instead of arcs',
      },
      ...scoreFilterConfigSchemaFields,
      ...regionTooLargeConfigSchemaFields,
    },
    {
      explicitlyTyped: true,
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
      preProcessSnapshot: snap => migrateLegacyArcRendererConfig(snap),
    },
  )
}

export type LinearArcDisplayConfigModel = ReturnType<typeof configSchemaFactory>
export type LinearArcDisplayConfig = Instance<LinearArcDisplayConfigModel>
