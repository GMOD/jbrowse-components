import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

/**
 * #config LinearMultiRowFeatureDisplay
 * #category display
 * Paints interval features as colored blocks on stacked rows ("chromosome /
 * ancestry painting"). Rows are partitioned by a feature attribute
 * (`partitionField`); each block's color comes from the per-feature `color`
 * slot.
 */
export default function configSchemaF(pluginManager: PluginManager) {
  const LinearGenomePlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { baseLinearDisplayConfigSchema } = LinearGenomePlugin.exports
  return ConfigurationSchema(
    'LinearMultiRowFeatureDisplay',
    {
      /**
       * #slot
       * Feature attribute whose value assigns each feature to a row (e.g. a BED
       * column name). Features sharing a value stack into the same row.
       */
      partitionField: {
        type: 'string',
        defaultValue: 'name',
        description: 'feature attribute that assigns each feature to a row',
      },
      /**
       * #slot
       * Per-block fill (a CSS color, or a `jexl:` expression for per-feature
       * coloring, e.g. `jexl:get(feature,'itemRgb')`).
       */
      color: {
        type: 'color',
        defaultValue: 'goldenrod',
        description:
          'fill color of each block (CSS color or jexl expression for per-feature coloring)',
        contextVariable: ['feature'],
      },
      /**
       * #slot
       * Optional explicit row order. Rows listed here come first in this order;
       * any remaining partition values are appended in sorted order. Empty =
       * fully auto (sorted).
       */
      rowOrder: {
        type: 'stringArray',
        defaultValue: [],
        description: 'optional explicit row order (by partition value)',
      },
      /**
       * #slot
       * Fixed height in pixels of each row. `0` (the default) auto-fits: all rows
       * stretch to fill the display height, so adding rows shrinks them instead of
       * growing the track — a dense, fully-visible painting.
       */
      rowHeight: {
        type: 'number',
        defaultValue: 0,
        description:
          'fixed row height in px; 0 (default) auto-fits all rows to the display height',
      },
      /**
       * #slot
       * Fraction of the row height each block fills (1 = full, leaving no gap
       * between rows).
       */
      rowProportion: {
        type: 'number',
        defaultValue: 0.9,
        description: 'fraction of the row height each block fills',
        advanced: true,
      },
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearMultiRowFeatureDisplayConfigModel = ReturnType<
  typeof configSchemaF
>
export type LinearMultiRowFeatureDisplayConfig =
  Instance<LinearMultiRowFeatureDisplayConfigModel>
