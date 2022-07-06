import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

const configSchema = ConfigurationSchema('SyntenyFeatureWidget', {})

const stateModel = types
  .model('SyntenyFeatureWidget', {
    id: ElementId,
    type: types.literal('SyntenyFeatureWidget'),
    featureData: types.frozen(),
  })
  .actions(self => ({
    setFeatureData(data: unknown) {
      self.featureData = data
    },
    clearFeatureData() {
      self.featureData = undefined
    },
  }))

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'SyntenyFeatureWidget',
        heading: 'Synteny feature details',
        configSchema,
        stateModel,
        ReactComponent: lazy(() => import('./SyntenyFeatureDetail')),
      }),
  )
}
