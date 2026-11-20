import { stateModelFactory as baseModelFactory } from '@jbrowse/core/BaseFeatureWidget'
import { types } from '@jbrowse/mobx-state-tree'

import type { TrioCall } from '../shared/trios.ts'
import type { Descriptions } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel VariantFeatureWidget
 * Feature-details widget for a VCF variant, extending the base feature widget
 * with variant-specific fields such as genotypes and INFO.
 */
export function stateModelFactory(pluginManager: PluginManager) {
  const baseModel = baseModelFactory(pluginManager)
  return types.compose(
    baseModel,
    types.model('VariantFeatureWidget', {
      /**
       * #property
       */

      type: types.literal('VariantFeatureWidget'),
      /**
       * #property
       */
      descriptions: types.frozen<Descriptions | undefined>(),
      /**
       * #property
       * Each trio's Mendelian check at the record, which the variant
       * display classifies from the full record when it opens the widget.
       */
      trioCalls: types.frozen<TrioCall[] | undefined>(),
    }),
  )
}

type VariantFeatureWidgetStateModel = ReturnType<typeof stateModelFactory>
export type VariantFeatureWidgetModel = Instance<VariantFeatureWidgetStateModel>
