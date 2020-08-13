import PluginManager from '@gmod/jbrowse-core/PluginManager'
import ReactComponent from './components/LinearSyntenyView'

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )
  return new ViewType({
    name: 'LinearSyntenyView',
    stateModel: jbrequire(require('./model')),
    ReactComponent,
  })
}
