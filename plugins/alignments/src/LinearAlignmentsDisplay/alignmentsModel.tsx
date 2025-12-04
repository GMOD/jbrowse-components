import { ConfigurationReference } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

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
      (() => {
        const displayTypes = getLowerPanelDisplays(pluginManager).map(
          f => f.stateModel,
        )
        const typeMap = Object.fromEntries(displayTypes.map(t => [t.name, t]))
        return types.union(
          {
            dispatcher: (snapshot: { type?: string }) =>
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              (snapshot?.type ? typeMap[snapshot.type] : undefined) ??
              displayTypes[0]!,
          },
          ...displayTypes,
        )
      })(),
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
