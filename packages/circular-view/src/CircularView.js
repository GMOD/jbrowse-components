import ReactComponentM from './components/CircularView'
import modelM from './models'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const ReactComponent = jbrequire(ReactComponentM)
  const { stateModel, configSchema } = jbrequire(modelM)
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  return new ViewType({
    name: 'CircularView',
    stateModel,
    configSchema,
    ReactComponent,
  })
}
