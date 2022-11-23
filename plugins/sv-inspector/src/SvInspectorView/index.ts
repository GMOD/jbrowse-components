import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import ReactComponent from './components/SvInspectorView'
import stateModelFactory from './models/SvInspectorView'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(() => {
    const { stateModel } = stateModelFactory(pluginManager)
    return new ViewType({
      name: 'SvInspectorView',
      stateModel,
      ReactComponent,
    })
  })
}
