import PluginManager from '@gmod/jbrowse-core/PluginManager'

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )
  return new ViewType({
    name: 'LinearSyntenyView',
    stateModel: jbrequire(require('./model')),
    ReactComponent: jbrequire(
      require('../LinearComparativeView/components/LinearComparativeView'),
    ),
  })
}
