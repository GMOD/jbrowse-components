import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import ReactComponent from './components/SvInspectorView'
import stateModelFactory from './models/SvInspectorView'

export default (pluginManager: PluginManager) => {
  const { stateModel } = stateModelFactory(pluginManager)

  pluginManager.addViewType(
    () => new ViewType({ name: 'SvInspectorView', stateModel, ReactComponent }),
  )
}
