import ReactComponentM from './components/CircularView'
import modelM from './models'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const ReactComponent = jbrequire(ReactComponentM)
  const stateModel = jbrequire(modelM)
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')

  const configSchema = ConfigurationSchema(
    'CircularView',
    {},
    { explicitlyTyped: true },
  )

  return new ViewType({
    name: 'CircularView',
    stateModel,
    configSchema,
    ReactComponent,
  })
}
