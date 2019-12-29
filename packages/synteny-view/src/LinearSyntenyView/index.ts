export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const { stateModel, configSchema } = jbrequire(require('./model'))

  return new ViewType({
    name: 'LinearSyntenyView',
    stateModel,
    configSchema,
    ReactComponent: jbrequire(require('./components/LinearSyntenyView')),
  })
}
