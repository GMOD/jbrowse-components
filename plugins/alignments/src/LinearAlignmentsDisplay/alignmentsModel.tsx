import { ConfigurationReference } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

// jbrowse
import { getLowerPanelDisplays } from './util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel LinearAlignmentsDisplayMixin
 */
export function LinearAlignmentsDisplayMixin(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types.model({
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
  })
}
