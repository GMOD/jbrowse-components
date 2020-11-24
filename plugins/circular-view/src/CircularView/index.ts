import PluginManager from '@jbrowse/core/PluginManager'
import ReactComponentF from './components/CircularView'
import ModelF from './models/CircularView'

export default ({ lib, load }: PluginManager) => {
  const ViewType = lib['@jbrowse/core/pluggableElementTypes/ViewType']

  const ReactComponent = load(ReactComponentF)
  const { stateModel } = load(ModelF)

  return new ViewType({ name: 'CircularView', stateModel, ReactComponent })
}

export type { CircularViewModel } from './models/CircularView'
