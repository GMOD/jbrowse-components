import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import ViewType from '@gmod/jbrowse-core/pluggableElementTypes/ViewType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  configSchemaFactory as basicTrackConfigSchemaFactory,
  stateModelFactory as basicTrackStateModelFactory,
} from './BasicTrack'
import {
  configSchemaFactory as dynamicTrackConfigSchemaFactory,
  stateModelFactory as dynamicTrackStateModelFactory,
} from './DynamicTrack'
import {
  ReactComponent as LinearGenomeViewReactComponent,
  stateModelFactory as linearGenomeViewStateModelFactory,
} from './LinearGenomeView'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = basicTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'BasicTrack',
        configSchema,
        stateModel: basicTrackStateModelFactory(configSchema),
      })
    })

    pluginManager.addTrackType(() => {
      const configSchema = dynamicTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'DynamicTrack',
        configSchema,
        stateModel: dynamicTrackStateModelFactory(configSchema),
      })
    })

    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'LinearGenomeView',
          stateModel: linearGenomeViewStateModelFactory(pluginManager),
          ReactComponent: LinearGenomeViewReactComponent,
        }),
    )
  }
}

export {
  default as BaseTrackControls,
} from './BasicTrack/components/TrackControls'
export { BaseTrackConfig } from './BasicTrack/baseTrackModel'
export {
  default as blockBasedTrackModel,
} from './BasicTrack/blockBasedTrackModel'
export {
  default as BlockBasedTrack,
} from './BasicTrack/components/BlockBasedTrack'
export { basicTrackConfigSchemaFactory, basicTrackStateModelFactory }
