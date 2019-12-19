import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import {
  AdapterClass as MCScanAnchorsAdapterClass,
  configSchema as mcScanAnchorsAdapterConfigSchema,
} from './MCScanAnchorsAdapter'
import {
  stateModelFactory as linearSyntenyTrackModelFactory,
  configSchemaFactory as linearSyntenyTrackConfigSchema,
} from './LinearSyntenyTrack'

export default class SyntenyViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SyntenyView')),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MCScanAnchorsAdapter',
          configSchema: mcScanAnchorsAdapterConfigSchema,
          AdapterClass: MCScanAnchorsAdapterClass,
        }),
    )
    pluginManager.addTrackType(() => {
      const configSchema = linearSyntenyTrackConfigSchema(
        pluginManager,
        'LinearSyntenyTrack',
      )
      return new TrackType({
        name: 'LinearSyntenyTrack',
        configSchema,
        stateModel: linearSyntenyTrackModelFactory(
          configSchema,
          'LinearSyntenyTrack',
        ),
      })
    })
  }

  configure() {}
}
