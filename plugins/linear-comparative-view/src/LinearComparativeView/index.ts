import ReactComponent from './components/LinearComparativeView'
import modelFactory from './model'

export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )
  return new ViewType({
    name: 'LinearComparativeView',
    stateModel: jbrequire(modelFactory),
    ReactComponent,
  })
}
