import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { version } from '../package.json'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  configSchemaFactory as linearArcDisplayConfigSchemaFactory,
  stateModelFactory as LinearArcDisplayStateModelFactory,
} from './LinearArcDisplay'
import ArcRenderer, {
  configSchema as ArcRendererConfigSchema,
  ReactComponent as ArcRendererReactComponent,
} from './ArcRenderer'

export default class MyProjectPlugin extends Plugin {
  version = version
  name = 'ArcRenderer'
  install(pluginManager: PluginManager) {
    const LGVPlugin = pluginManager.getPlugin(
      'LinearGenomeViewPlugin',
    ) as import('@jbrowse/plugin-linear-genome-view').default
    //@ts-ignore
    const { BaseLinearDisplayComponent } = LGVPlugin.exports

    pluginManager.addRendererType(
      () =>
        // @ts-ignore error "expected 0 arguments, but got 1"?
        new ArcRenderer({
          name: 'ArcRenderer',
          ReactComponent: ArcRendererReactComponent,
          configSchema: ArcRendererConfigSchema,
          pluginManager,
        }),
    )
    pluginManager.addDisplayType(() => {
      const configSchema = linearArcDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearArcDisplay',
        configSchema,
        stateModel: LinearArcDisplayStateModelFactory(
          configSchema,
          pluginManager,
        ),
        trackType: 'ArcTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })

    pluginManager.jexl.addFunction(
      'logThickness',
      (feature: any, attributeName: string) => {
        return Math.log(feature.get(attributeName) + 1)
      },
    )
  }
}
