import ReactComponent from './components/SvInspectorView'
import StateModelFactory from './models/SvInspectorView'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

const SvInspectorViewF = ({ jbrequire }) => {
  const { stateModel } = jbrequire(StateModelFactory)

  return new ViewType({ name: 'SvInspectorView', stateModel, ReactComponent })
}

export default SvInspectorViewF
