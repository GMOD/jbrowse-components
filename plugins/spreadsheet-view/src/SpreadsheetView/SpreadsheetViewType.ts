import PluginManager from '@jbrowse/core/PluginManager'
import ReactComponentFactory from './components/SpreadsheetView'
import stateModelFactory from './models/SpreadsheetView'

export default ({ jbrequire }: PluginManager) => {
  const ViewType = jbrequire('@jbrowse/core/pluggableElementTypes/ViewType')

  const ReactComponent = jbrequire(ReactComponentFactory)
  const stateModel = jbrequire(stateModelFactory)

  return new ViewType({ name: 'SpreadsheetView', stateModel, ReactComponent })
}
