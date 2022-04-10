import ReactComponent from './components/SvInspectorView'
import StateModelFactory from './models/SvInspectorView'

const SvInspectorViewF = ({ jbrequire }) => {
  const ViewType = jbrequire('@jbrowse/core/pluggableElementTypes/ViewType')

  const { stateModel } = jbrequire(StateModelFactory)

  return new ViewType({ name: 'SvInspectorView', stateModel, ReactComponent })
}

export default SvInspectorViewF
