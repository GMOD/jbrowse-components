import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { getLowerPanelDisplays } from './util'
import { SharedModificationsMixin } from '../shared/SharedModificationsMixin'

import type { ColorBy, FilterBy } from '../shared/types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel LinearAlignmentsDisplayMixin
 */
export function LinearAlignmentsDisplayMixin(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(SharedModificationsMixin(), types.model({
      /**
       * #property
       * refers to LinearPileupDisplay sub-display model
       */
      PileupDisplay: types.maybe(
        types.union(
          ...getLowerPanelDisplays(pluginManager).map(f => f.stateModel),
        ),
      ),
      /**
       * #property
       * refers to LinearSNPCoverageDisplay sub-display model
       */
      SNPCoverageDisplay: types.maybe(
        pluginManager.getDisplayType('LinearSNPCoverageDisplay')!.stateModel,
      ),
      /**
       * #property
       */
      snpCovHeight: 45,
      /**
       * #property
       */
      type: types.literal('LinearAlignmentsDisplay'),
      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),
      /**
       * #property
       */
      heightPreConfig: types.maybe(types.number),
      /**
       * #property
       */
      userFeatureScreenDensity: types.maybe(types.number),
      /**
       * #property
       */
      lowerPanelType: 'LinearPileupDisplay',
      /**
       * #property
       */
      colorBySetting: types.frozen<ColorBy | undefined>(),
      /**
       * #property
       */
      filterBySetting: types.frozen<FilterBy | undefined>(),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get colorBy(): ColorBy | undefined {
        return self.colorBySetting ?? getConf(self, 'colorBy')
      },
      /**
       * #getter
       */
      get filterBy(): FilterBy | undefined {
        return self.filterBySetting ?? getConf(self, 'filterBy')
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setColorScheme(colorBy?: ColorBy) {
        self.colorBySetting = colorBy ? { ...colorBy } : undefined
      },
      /**
       * #action
       */
      setFilterBy(filter: FilterBy) {
        self.filterBySetting = { ...filter }
      },
    }))
}
