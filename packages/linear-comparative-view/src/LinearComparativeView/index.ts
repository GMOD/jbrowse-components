export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const { stateModel, configSchema } = jbrequire(require('./model'))

  return new ViewType({
    name: 'LinearComparativeView',
    stateModel,
    configSchema,
    ReactComponent: jbrequire(require('./components/LinearComparativeView')),
  })
}
