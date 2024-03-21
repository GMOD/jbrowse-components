import PluginManager from '@jbrowse/core/PluginManager'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { BaseLinearDisplayComponent } from '../BaseLinearDisplay'

// locals
import configSchema from './configSchema'
import modelFactory from './model'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const config = configSchema(pluginManager)
    return new DisplayType({
      ReactComponent: BaseLinearDisplayComponent,
      configSchema: config,
      displayName: 'Basic feature display',
      name: 'LinearBasicDisplay',
      stateModel: modelFactory(config),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
    })
  })
}

export { default as modelFactory } from './model'
export { default as configSchema } from './configSchema'
