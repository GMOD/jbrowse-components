import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import Color from 'color'
import HicAdapterFactory from './HicAdapter'
import HicRenderer, {
  configSchema as hicRendererConfigSchema,
  ReactComponent as HicRendererReactComponent,
} from './HicRenderer'
import {
  configSchemaFactory as linearHicdisplayConfigSchemaFactory,
  modelFactory as linearHicdisplayModelFactory,
} from './LinearHicDisplay'

export default class HicPlugin extends Plugin {
  name = 'HicPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'HicAdapter',
          ...pluginManager.jbrequire(HicAdapterFactory),
        }),
    )
    pluginManager.addRendererType(
      () =>
        new HicRenderer({
          name: 'HicRenderer',
          ReactComponent: HicRendererReactComponent,
          configSchema: hicRendererConfigSchema,
          pluginManager,
        }),
    )
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'HicTrack',
        {},
        {
          baseConfiguration: createBaseTrackConfig(pluginManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name: 'HicTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'HicTrack',
          configSchema,
        ),
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema = linearHicdisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearHicDisplay',
        configSchema,
        stateModel: linearHicdisplayModelFactory(configSchema),
        trackType: 'HicTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    pluginManager.jexl.addTransform('alpha', (color: Color, value: number) =>
      color.alpha(value),
    )
    pluginManager.jexl.addTransform('hsl', (color: Color) => color.hsl())
    pluginManager.jexl.addTransform('colorString', (color: Color) =>
      color.string(),
    )
  }
}
