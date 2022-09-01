import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import {
  linearBasicDisplayConfigSchemaFactory,
  linearBasicDisplayModelFactory,
  BaseLinearDisplayComponent,
} from '@jbrowse/plugin-linear-genome-view'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = linearBasicDisplayConfigSchemaFactory(pluginManager)
    let str = 'LGVSyntenyDisplay'
    const newConfig = ConfigurationSchema(
      str,
      {},
      { baseConfiguration: configSchema, explicitlyTyped: true },
    )
    const stateModel = linearBasicDisplayModelFactory(newConfig)
    const newModel = stateModel.named(str).props({ type: str })
    return new DisplayType({
      name: str,
      configSchema: newConfig,
      stateModel: newModel,
      trackType: 'SyntenyTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}
