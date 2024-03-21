import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

const configSchema = ConfigurationSchema('SyntenyFeatureWidget', {})

const stateModel = types
  .model('SyntenyFeatureWidget', {
    featureData: types.frozen(),
    id: ElementId,
    type: types.literal('SyntenyFeatureWidget'),
  })
  .actions(self => ({
    clearFeatureData() {
      self.featureData = undefined
    },
    setFeatureData(data: unknown) {
      self.featureData = data
    },
  }))

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        ReactComponent: lazy(() => import('./SyntenyFeatureDetail')),
        configSchema,
        heading: 'Synteny feature details',
        name: 'SyntenyFeatureWidget',
        stateModel,
      }),
  )
}
