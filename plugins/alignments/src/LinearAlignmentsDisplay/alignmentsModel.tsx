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
    .compose(
      SharedModificationsMixin(),
      types.model({
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
      }),
    )
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
       * Sets colorBy on this display and propagates to nested displays
       */
      setColorScheme(colorBy?: ColorBy) {
        const newColorBy = colorBy ? { ...colorBy } : undefined
        self.colorBySetting = newColorBy
        // Propagate to nested displays
        if (self.PileupDisplay?.setColorScheme) {
          self.PileupDisplay.setColorScheme(newColorBy)
        }
        if (self.SNPCoverageDisplay?.setColorScheme) {
          self.SNPCoverageDisplay.setColorScheme(newColorBy)
        }
      },
      /**
       * #action
       * Sets filterBy on this display and propagates to nested displays
       */
      setFilterBy(filter: FilterBy) {
        const newFilter = { ...filter }
        self.filterBySetting = newFilter
        // Propagate to nested displays
        if (self.PileupDisplay?.setFilterBy) {
          self.PileupDisplay.setFilterBy(newFilter)
        }
        if (self.SNPCoverageDisplay?.setFilterBy) {
          self.SNPCoverageDisplay.setFilterBy(newFilter)
        }
      },
    }))
}
