import ReactComponentFactory from './components/SvInspectorView'
import StateModelFactory from './models/SvInspectorView'

export default ({ jbrequire }) => {
  const ViewType = jbrequire('@jbrowse/core/pluggableElementTypes/ViewType')

  const ReactComponent = jbrequire(ReactComponentFactory)
  const { stateModel } = jbrequire(StateModelFactory)

  return new ViewType({ name: 'SvInspectorView', stateModel, ReactComponent })
}
