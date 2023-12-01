import { types } from 'mobx-state-tree'

// jbrowse
import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { getLowerPanelDisplays } from './util'

/**
 * #stateModel LinearAlignmentsDisplayMixin
 */
export function LinearAlignmentsDisplayMixin(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const lowerPanelDisplays = getLowerPanelDisplays(pluginManager).map(
    f => f.stateModel,
  )

  return types.model({
    /**
     * #property
     * refers to LinearPileupDisplay sub-display model
     */
    PileupDisplay: types.maybe(types.union(...lowerPanelDisplays)),
    /**
     * #property
     * refers to LinearSNPCoverageDisplay sub-display model
     */
    SNPCoverageDisplay: types.maybe(
      pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
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
