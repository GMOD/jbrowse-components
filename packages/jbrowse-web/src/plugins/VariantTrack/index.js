import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import Plugin from '@gmod/jbrowse-core/Plugin'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import { types } from 'mobx-state-tree'
import { ElementId } from '@gmod/jbrowse-core/mst-types'
import VariantFeatureDrawerWidgetComponent from './components/VariantFeatureDrawerWidget'

import configSchemaFactory from './configSchema'

import modelFactory from './model/variantTrack'

const VariantFeatureDrawerWidgetModel = types
  .model('VariantFeatureDrawerWidget', {
    id: ElementId,
    type: types.literal('VariantFeatureDrawerWidget'),
  })
  .volatile(() => ({
    featureData: {},
  }))
  .actions(self => ({
    setFeatureData(data) {
      self.featureData = data
    },
    clearFeatureData() {
      self.featureData = {}
    },
  }))

export default class VariantTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = configSchemaFactory(pluginManager)

      const stateModel = modelFactory(pluginManager, configSchema)

      return new TrackType({
        name: 'VariantTrack',
        configSchema,
        stateModel,
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      const stateModel = VariantFeatureDrawerWidgetModel

      const configSchema = ConfigurationSchema('VariantFeatureDrawerWidget', {})

      return new DrawerWidgetType({
        name: 'VariantFeatureDrawerWidget',
        heading: 'Feature Details',
        configSchema,
        stateModel,
        LazyReactComponent: VariantFeatureDrawerWidgetComponent,
      })
    })
  }
}
