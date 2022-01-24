import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'

const configSchema = ConfigurationSchema('AlignmentsFeatureWidget', {})

export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('AlignmentsFeatureWidget', {
      id: ElementId,
      type: types.literal('AlignmentsFeatureWidget'),
      featureData: types.frozen(),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .actions(self => ({
      setFeatureData(data: unknown) {
        self.featureData = data
      },
      clearFeatureData() {
        self.featureData = undefined
      },
    }))
}

export default function register(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'AlignmentsFeatureWidget',
        heading: 'Feature details',
        configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(() => import('./AlignmentsFeatureDetail')),
      }),
  )
}

export { configSchema }
