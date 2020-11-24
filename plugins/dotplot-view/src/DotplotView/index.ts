import modelFactory from './model'
import ReactComponentFactory from './components/DotplotView'

export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire('@jbrowse/core/pluggableElementTypes/ViewType')
  return new ViewType({
    name: 'DotplotView',
    stateModel: jbrequire(modelFactory),
    ReactComponent: jbrequire(ReactComponentFactory),
  })
}
