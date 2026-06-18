import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import { migrateLegacyArcRendererConfig } from './migrate.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearArcDisplay
 *
 * #example
 * Selected on a `FeatureTrack`; each feature is drawn as an arc from its start
 * to its end. `displayMode` is `arcs` or `semicircles`:
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
 *     },
 *   ],
 * }
 * ```
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearArcDisplay',
    {
      /**
       * #slot
       */
      color: {
        type: 'color',
        description: 'the color of the arcs',
        defaultValue: 'darkblue',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       */
      thickness: {
        type: 'number',
        description: 'the thickness of the arcs',
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
        type: 'enum',
        defaultValue: 'arcs',
        model: types.enumeration('DisplayMode', ['arcs', 'semicircles']),
        description: 'render semi-circles instead of arcs',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
      preProcessSnapshot: snap => migrateLegacyArcRendererConfig(snap),
    },
  )
}

export type LinearArcDisplayConfigModel = ReturnType<typeof configSchemaFactory>
export type LinearArcDisplayConfig = Instance<LinearArcDisplayConfigModel>
